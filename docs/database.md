# Supabase database

The styled `frontend/` app is the only application in this project. It uses the
`demo_*` tables with real sessions, private image Storage and Realtime. The root
`src/` app's legacy schema was retired on 11 November 2026 (see the note after
the demo sections below).


Project: **CS4353 Final Project**, reference `ejgvfgvrmcwrixxdvwwt`.
The ignored `.env` contains the URL and browser-safe publishable key. Privileged
keys and database passwords must never enter frontend code or Git. Do not expose
the `private` or `supabase_migrations` schemas through the Data API.

## Connected completion: verified 6 November 2026

The current demo uses four provisioned characters: **Eric, Sarah, Ben and Maya**.
Their shared state is stored in `demo_*` tables; the root-frame tables that once
shared this project belonged to the legacy application (retired 11 November
2026, see below).

Migration `20261106000100_connected_completion.sql` adds `demo_help_requests` and
`demo_offers`, member-only reads and Realtime publication. Existing `demo_state` and
`demo_command` RPC names remain unchanged. Help commands enforce roles, request
closure, listed-item ownership, dates and availability. Request-row locks serialize
selection/closure/withdrawal; ordinary loan creation and request selection commit
atomically. Cancellation never reopens selected Help history.

The command dispatcher also supports borrower-only `edit-review` with the existing
loan revision and request-key rules. An edit can keep, replace or remove its photo
without reopening the completed loan. `demo_command_base` is an internal helper;
`anon` and `authenticated` cannot execute it directly.

The migration was rehearsed with all earlier migrations on disposable Supabase
PostgreSQL 17.11, then tested in a rollback-only transaction against the managed
project. It was applied with exact SQL stored in migration history in the same
transaction. Both current suites (`shared_demo.sql`, `feature_frame.sql`) passed
locally and against managed Supabase after deployment; synthetic fixtures rolled back.
Local Storage uses a minimal SQL fixture; managed checks exercise the real policies.
Physical files, cameras and hosted browser acceptance are separate checks.

On 6 November 2026 the locker handover change replaced the user-entered
locker number with a locker assigned by the simulated scan. The hosted
project's recorded migration sources predate that wording, so
`public.demo_command_base` was re-deployed through the dashboard SQL editor
as a `create or replace` from the current `20261106000100` source (no new
version was recorded). The updated suites pass on a `supabase db reset`
local stack; re-running `shared_demo.sql` against the managed database
confirms the re-deployment.

To repeat the current SQL suites on a disposable, migrated local Supabase stack
(`supabase db reset` first). The CLI's `db query --file` cannot run these
multi-statement suites (it uses a single prepared statement), so run them through
psql inside the database container (`supabase_db_CS4353_-_Final_Prototype` for this
repository):

```sh
cat supabase/tests/shared_demo.sql | docker exec -i -e PGPASSWORD=postgres supabase_db_CS4353_-_Final_Prototype psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1
cat supabase/tests/demo_sprite.sql | docker exec -i -e PGPASSWORD=postgres supabase_db_CS4353_-_Final_Prototype psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1
```

Use `supabase db query --remote` only for an explicitly selected managed project.
Both scripts create synthetic records inside a transaction and finish with
rollback; do not remove that rollback.

## Connected styled demo: verified 5 November 2026

Migration `20261105000100_shared_demo.sql` is applied. Its exact source and version
were recorded in migration history in the same transaction through the CLI SQL
query endpoint; the CLI's direct database connection was unavailable.

- `supabase/tests/shared_demo.sql` passed against the hosted database; all synthetic
  fixtures rolled back. It covers loan transitions, overlapping reservations,
  stale revisions, actor permissions, image attachment checks, private reads,
  condition resolution, reviews and retry-safe messages.
- Eric, Sarah, Ben and Maya are provisioned: four profiles, 39 listings and four
  example loans, with the `styled-v1` seed completion marker present.
- Each account passed live public-API sign-in, `demo_state`, signed seed-image
  download and Realtime subscription checks. These checks do not establish
  end-to-end event delivery or browser behavior.
- The `demo-images` bucket is private, accepts JPEG/PNG/WebP up to 5 MB, and has
  upload, read and unused-own-image deletion policies. All ten application tables
  subscribed to by the frontend belong to `supabase_realtime`.

Generated account passwords are in the ignored repository-root `.demo-accounts.txt`
with private file permissions. Do not commit or paste them into reports. The
temporary administrator key used for provisioning was removed.

The connected hosted browser journey subsequently passed on 5 November 2026 at commit
`4e7afab`: separate Eric/Sarah tabs, request and approval, four private photo uploads,
return verification, review, realtime messages in both directions and reload
persistence. See [hosting
verification](hosting.md#hosted-browser-verification-5-november-2026) for the test
record and limits. That verification predates the merge into `main`; the current
public demo and release status are documented in [hosting](hosting.md).

## Legacy schema (retired 11 November 2026)

Migration `20261112000200_drop_legacy_cluster.sql` dropped the root `src/`
app's schema: the `profiles`, `sprites`, `items`, `item_images`, `lockers`,
`item_lockers`, `loans`, `chats`, `messages`, `reviews`, `friendships` tables,
`private.handoff_challenges` and `private.prototype_config`, the
`item_catalog`/`loan_catalog` views, and the legacy commands and private
helpers (`create_loan`, `simulate_locker_scan`, `save_review`,
`send_message`, and the rest listed in `docs/supabase-cleanup.md`). The
root-app data (8 profiles, 8 sprites, 10 seeded locker names) was
root-app-only and discarded with the tables; the earlier detailed description
of that schema survives in the git history of this document. The live demo is
unaffected because it uses only the `demo_*` objects.

Two legacy objects are deliberately kept because `demo_update_sprite` uses
them: `private.valid_face_strokes(jsonb)` and the `public.sprite_colour`
enum type (its eight palette names). The `btree_gist` extension stays for
`demo_loans`' overlap exclusion. The only remaining Storage bucket is
`demo-images`, and `supabase_realtime` publishes only the twelve `demo_*`
tables.

## Migration and verification

Apply migrations in filename order on a new project. This hosted project already
has versions `20261030000100`, `20261030000200`, `20261030000300` recorded; do not
reapply them. `20261030000300_feature_frame.sql` was rehearsed with rollback tests,
then deployed on 30 October 2026 with its exact source recorded in migration history.

The legacy root-app suites were removed in stages: `feature_frame.sql` and
`review_card.sql` with the legacy Storage buckets
(`20261112000100_drop_legacy_storage.sql`), then `sprite_face.sql` and
`sprite_palette.sql` with the full schema cluster
(`20261112000200_drop_legacy_cluster.sql`). The live demo is covered by
`shared_demo.sql` and `demo_sprite.sql`; see `docs/supabase-cleanup.md` for the
audit.
Live checks create temporary `[smoke]` rows; an administrator can remove these
after reviewing the results. Uploaded test files are removed by the test workflow.
Frontend unit/component tests and `pnpm build` provide local checks without hosted
writes.
