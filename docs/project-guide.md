# Current project guide

Updated 6 November 2026 after the connected demo was merged into `main`
(merge commit `8f7b006`, including locker-flow change `1692347`).

## Application boundaries

The root `src/` application is the plain Supabase functionality frame. The
`frontend/src/` application is the current public community lending demo at
https://cs4353-demo.pages.dev/. Starting
one does not start the other. They have separate package manifests, lockfiles, models,
accounts, routes and persistence. The styled app uses separate `demo_*` tables in the
same Supabase project.

| Task | Supabase frame, repository root | Styled preview, `frontend/` |
| --- | --- | --- |
| Install | `pnpm install` | `npm ci` |
| Start | `pnpm dev` (port 3000) | `npm run dev` (port 3001) |
| Configure | `.env` URL and publishable key | `frontend/.env` URL and publishable key |
| Identity | Real Supabase sessions; private demo credentials | Real Supabase sessions; Eric/Sarah/Ben/Maya credentials |
| Tests | `pnpm test` | `npm test` and `npm run test:rendered` |
| Build | `pnpm build` | `npm run build` |

Use Node.js 24 for both. Root dependencies use pnpm; the preview uses npm's
committed `package-lock.json`. Never place a privileged key in browser configuration.

## Styled preview code map

| Location under `frontend/src/` | Responsibility |
| --- | --- |
| `App.tsx`, `app/routes.ts` | Hash routing, five primary tabs, chats/notifications and modal flows |
| `app/domain.ts` | Types, commands, permission checks, booking and handover rules |
| `app/context.tsx` | Loads shared state, submits commands, observes sessions and Realtime |
| `services/demo.ts` | Supabase session, command RPC, signed images, uploads and Realtime adapter |
| `app/seed.ts` | Eric, Sarah, Ben, Maya and initial examples |
| `app/images.ts` | Local photo validation/resizing |
| `pages/borrow/` | Catalog, prefix search, filters, item details and schematic map |
| `features/` | Listings, friends, profiles, loans, reviews, chats, notifications and locker interactions |
| `components/ui/` | Shared controls, photo input and QR rendering |
| `vendor/qrcodegen.ts` | Vendored QR encoder; license in `public/third-party-licenses.txt` |

Change pure domain behavior and its tests together. Connected authorization and
lifecycle transitions are also enforced by `demo_command` in migration
`20261105000100_shared_demo.sql` and
`20261106000100_connected_completion.sql`; a client-only change does not update server rules. The
adapter calls `demo_state` and `demo_command` and refreshes on Realtime changes. Photos
upload to private `demo-images` Storage and display through signed URLs.

The seeded characters are Eric, Sarah, Ben and Maya. The current provisioning script
is `frontend/scripts/provision-demo.ts`; the root seed script belongs to the legacy
frame. Private account credentials are distributed separately.

Auth uses sessionStorage per tab and a unique channel for each client, isolating
other tabs' login/logout events. All builds configured with the same backend share
activity; sign-out ends a tab's session and does not erase shared records.
No browser-only reset exists.

## Workflow differences to preserve explicitly

| Behavior | Supabase frame | Styled preview |
| --- | --- | --- |
| Locations | Ten fixed lockers; multiple allowed per item | Clementi, Toa Payoh and Kent Ridge |
| Requests | Accepted friendship required | Listed items from another owner |
| Plan changes | Borrower edits before pickup; owner reapproves | Either participant edits before owner dropoff; other participant reapproves |
| Cancel | Before borrower pickup | Before owner dropoff |
| Handover | Scan advances state, then a separate pending photo | Display QR for external scanner; preview bypass; the scan assigns an available locker, then a photo |
| Final return | Owner scan immediately marks Returned/Past; evidence still required | Owner pickup enters verifying; good condition or issue resolution completes loan |
| Review | Optional text/compliments/image; author edit/delete | Borrower create/edit with rating 1–5, text, compliments and optional photo |
| Chat | Separate two-person chat records, images and Realtime | Shared person-to-person text threads with Realtime; optional loan references |
| Date conflicts | Inclusive reservations retained except cancelled loans | Inclusive conflicts exclude complete, declined and cancelled loans |

These lifecycles remain separate and are enforced in their corresponding server
commands. QR codes simulate handovers; physical locker hardware is not connected.

## Verification and further work

Run each application's commands in its own directory. Preview tests cover domain,
community, communication, routing, handover and serialized complete journeys. Rendered
checks render routes, check asset references and generate a QR matrix; they do not
establish browser layout or physical locker-device compatibility. For a manual journey, follow
`frontend/README.md` using separate Eric and Sarah signed-in sessions.

The root app's database coverage and schema were fully retired in two migrations:
`20261112000100_drop_legacy_storage.sql` removed the legacy Storage buckets and the
`feature_frame.sql`/`review_card.sql` suites, and
`20261112000200_drop_legacy_cluster.sql` dropped the remaining legacy tables, views,
functions and the `sprite_face.sql`/`sprite_palette.sql` suites (see
`docs/supabase-cleanup.md`). The connected demo is covered by
`supabase/tests/shared_demo.sql` and `supabase/tests/demo_sprite.sql`. Pulling
frontend changes does not deploy a database migration.

The connected migrations are applied. The release owner checked the preview and
merged the feature branch into `main`. Cloudflare publishes the current demo from
`frontend/`; see [hosting](hosting.md) for configuration, historical test evidence
and production verification. The earlier `4e7afab` preview is a historical test build.
