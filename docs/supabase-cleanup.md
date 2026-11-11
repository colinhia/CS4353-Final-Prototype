# Supabase unused-object audit (2026-11-11)

Scope: every table, view, and function created by `supabase/migrations/`, checked
against **all** client code (`frontend/src`, `frontend/scripts`, root `src`,
`scripts/`) and cross-references inside the migrations themselves.

## Key context: two apps, two schemas' worth of objects

| App | Location | Deployed? | Supabase objects it uses |
| --- | --- | --- | --- |
| **Live demo** | `frontend/` | Yes — Cloudflare Pages builds `frontend/` from `main` (cs4353-demo.pages.dev) | only the `demo_*` tables, `demo_state` / `demo_command` / `demo_command_base` / `demo_update_sprite` RPCs, their `demo_*` helper functions, the `demo-images` storage bucket, and `private.valid_face_strokes` (called by `demo_update_sprite`) |
| **Root app** ("existing Supabase application… independent", per `frontend/README.md`) | `src/` | **No** — not built or hosted anywhere; runs locally only | the legacy model: `profiles`, `sprites`, `items`, `item_images`, `item_lockers`, `loans`, `lockers`, `chats`, `messages`, `reviews`, `friendships`, plus `private.handoff_challenges`, `private.prototype_config`, the `item_catalog` / `loan_catalog` views, and the `create_loan` / `approve_loan` / `cancel_loan` / `modify_loan` / `create_item` / `set_item_lockers` / `get_handoff_qr` / `simulate_locker_scan` / `record_handoff_photo` / `send_message` / `get_chat_summaries` / `get_reviews` / `save_review` / `delete_review` RPCs |

Verified: no live-demo migration or `frontend/` file references any legacy public
table, view, or RPC, and the root app never references any `demo_*` object. The two
worlds are disjoint **except for exactly two legacy objects the live demo depends on**:
`private.valid_face_strokes(jsonb)` (called by `demo_update_sprite`) and the
`public.sprite_colour` enum type (colour validation in `demo_update_sprite`). Both must
survive any cleanup. (The `auth.users` trigger described under Tier 3 also touches the
shared `auth.users` table, though only to write the legacy `profiles` row.)

## Tier 1 — dead, safe to drop now (zero references anywhere)

| Object | Type | Created | Evidence of non-use |
| --- | --- | --- | --- |
| `public.user_compliments` | view | 20261030000200 | Only references are its own `create` and `grant` lines. No code, no later migration, no other view uses it. |
| `public.user_locations` | view | 20261030000200 (replaced a same-named table dropped in the same migration) | No code references; not referenced by any migration after 000200; final `item_catalog`/`loan_catalog` do not use it. |
| `public.item_locations` | table | 20261030000200 | Zero client references. Not referenced by final `item_catalog` or `loan_catalog`. Only consumer is the dead `user_locations` view. |
| `private.record_loan_verification()` | function | 20261030000200 | Its only caller was trigger `record_lending_verification` on `storage.objects`, which 20261030000300 already drops. |

Already cleaned up in history (no action): `public.start_loan`, `public.submit_loan_review`
(dropped by 000300), `public.return_loan` and the original `user_locations` table
(dropped by 000200).

### Cleanup migration (Tier 1) — `supabase/migrations/20261111000100_drop_unused_legacy_objects.sql`

Drops the four objects above (views first, since `user_locations` selects from
`item_locations`). It also raises an error if `public.item_locations` still holds
rows, matching the data guard 20261030000200 used when it dropped the original
`user_locations` table. No foreign key points at `item_locations`, and no
policy, trigger, or later migration references any of the four, so the drop order
is safe. `supabase/tests/feature_frame.sql` does not exercise them, so no test
changes are needed for Tier 1.

Local verification on a fresh migrated stack:

```sh
supabase db reset          # applies all migrations including the new one
supabase db query --file supabase/tests/feature_frame.sql
supabase db query --file supabase/tests/shared_demo.sql
```

## Tier 2 — near-dead (worth a decision, not an automatic drop)

| Object | Situation |
| --- | --- |
| `public.save_review_v2` | Created by 20261107000300. No client calls it: the root app calls `save_review` (v1, deliberately kept per that migration's comments) and the live demo saves reviews through `demo_command`. Only `supabase/tests/review_card.sql` exercises it. Drop it, or point the root app's review form at it, but don't keep both silently. |
| `private.palette_colour_for(uuid)` | Used only by root-app machinery: the 000200 sprite trigger, the 0007000200 backfill, and `public.sprites` colour typing. If the root app is retired (Tier 3), this goes with it. |

## Tier 3 — retire the whole legacy block (root app not needed)

Everything below is used **exclusively** by the root app in `src/`, which is not
deployed. Verified against the **live hosted project** (`ejgvfgvrmcwrixxdvwwt`,
read-only) on 2026-11-11: every legacy table is empty **except** `public.profiles`
(8 rows, all root-app: each owns one `user`-category sprite), `public.sprites`
(8 rows), and `public.lockers` (10 rows, `location1`–`location10`, root-app seed).
All five legacy storage buckets hold **0 objects**; only `demo-images` has data (28).
The demo's locker options are hardcoded strings (`clementi`, `toa-payoh`,
`kent-ridge`) validated inside `demo_command_base` — it never reads `public.lockers`.
`item_catalog`/`loan_catalog` have no external dependents.

### Priority 1 — low-hanging, breaks nothing (standalone migration)

Drop the **5 legacy storage buckets** and their **10 `storage.objects` policies**.
Fully isolated from the demo (which only uses `demo-images`), all empty, no foreign
keys involved — so dropping them can't cascade into the demo:

- Buckets: `chat-images`, `item-images`, `loan-review-images`, `loan-verification`,
  `profile-images`
- Policies on `storage.objects`: `chat_image_read`, `chat_image_upload`,
  `lending_images_read`, `lending_images_upload`, `lending_images_delete`,
  `review_image_read`, `review_image_upload`, `verification_upload`,
  `verification_read`, `unused_proof_delete`

Safe to merge and verify on its own (the two `demo_*` suites must still pass).

### Priority 2 — the full root-app retirement (one cohesive migration)

The remaining objects form **one self-contained FK cluster** (`messages→chats→
profiles→sprites`, `loans→items/lockers/profiles`, `item_images/item_lockers→items`,
`reviews→loans`, `handoff_challenges→loans/profiles`), so they retire together, in
this FK-safe order:

1. **Triggers** first: `items_assign_sprite`, `items_remove_sprite`,
   `profiles_assign_sprite`, `profiles_remove_sprite` (on `items`/`profiles`), then
   `on_auth_user_created` (on `auth.users`) — ⚠️ this inserts a `public.profiles` row
   for **every** auth user including the demo accounts; the demo doesn't need it
   (`demo_profiles` is provisioned separately by `frontend/scripts/provision-demo.ts`).
2. **Realtime:** `alter publication supabase_realtime drop table public.messages;`
   (the only legacy table in the publication; all 12 `demo_*` tables stay).
3. **Tables** (children before parents): `messages`, `reviews`,
   `private.handoff_challenges`, `item_images`, `item_lockers`, `loans`, `chats`,
   `friendships`, `items`, `lockers`, `profiles`, `sprites`, then
   `private.prototype_config`.
4. **Views:** `item_catalog`, `loan_catalog`.
5. **Functions:** all legacy public RPCs (`create_loan`, `create_item`, `approve_loan`,
   `cancel_loan`, `modify_loan`, `set_item_lockers`, `get_handoff_qr`,
   `simulate_locker_scan`, `record_handoff_photo`, `send_message`,
   `get_chat_summaries`, `get_reviews`, `save_review`, `save_review_v2`,
   `delete_review`) and private helpers (`assign_sprite`, `remove_sprite`,
   `create_profile`, `can_view_owner`, `chat_member`, `is_friend`,
   `item_compliments`, `item_on_loan`, `item_status`, `loan_owner`, `next_scan`,
   `pending_photo`, `step_actor`, `review_image_visible`,
   `can_upload_verification`, `palette_colour_for`).
   **Keep `private.valid_face_strokes`** — `demo_update_sprite` calls it.
6. **Tests/docs:** delete `supabase/tests/feature_frame.sql`, `review_card.sql`,
   `sprite_face.sql`, `sprite_palette.sql` (all target the legacy model;
   `shared_demo.sql` and `demo_sprite.sql` stay and must still pass). Update
   `docs/database.md`, which documents the root-app schema.

Notes:
- **Keep** `public.sprite_colour` (enum) — `demo_update_sprite` validates colours
  against `enum_range(null::public.sprite_colour)`. Dropping `public.sprites` does not
  drop the type (types live in their own namespace).
- The 8 legacy `profiles`/`sprites` rows and 10 `lockers` rows are root-app data only;
  dropping the tables removes them. If you'd rather keep them, snapshot first.
- Re-verify on the PR preview that the deployed demo still works before merging.

## Keep — live demo surface (do not touch)

- Tables: `demo_seed_versions`, `demo_profiles`, `demo_items`, `demo_loans`,
  `demo_reviews`, `demo_approvals`, `demo_conditions`, `demo_proofs`,
  `demo_friendships`, `demo_messages`, `demo_notices`, `demo_requests`,
  `demo_offers`, `demo_help_requests` (the last three have zero *client* references by
  design — they are read/written inside `demo_command`/`demo_command_base`).
- Functions: `demo_state`, `demo_command`, `demo_command_base`, `demo_update_sprite`,
  `demo_member`, `demo_participant`, `demo_notify`, `demo_image_allowed`,
  `demo_review_image_visible`, `demo_public_reviews`, `private.valid_face_strokes`.
- Types: `public.sprite_colour` (enum) — used by `demo_update_sprite` colour checks.
- Storage bucket `demo-images`.
- `demo_seed_versions` is also queried directly by `frontend/scripts/provision-demo.ts`.

## Suggested order of work

1. Merge the Tier 1 draft migration now (small, safe, verifiable on the PR preview).
2. Decide on `save_review_v2` (drop or adopt).
3. Team decision: retire the root app? If yes, add the Tier 3 migration and update
   `docs/database.md` + the three legacy test files in the same PR.
