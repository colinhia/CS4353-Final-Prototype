# Feature frame architecture

This document describes the Supabase application in root `src/`. The newer
`frontend/` preview has a separate state model and persistence layer; see
[the project guide](project-guide.md). Neither application currently calls the
other's services.


The five pages compose small feature services. Services accept the `DataGateway`
interface; they do not own React state, query caches or page navigation. Supabase
calls and authentication/storage details live in `src/core/gateway.ts`. The
composition root is `src/core/services.ts`.

> **Status (11 November 2026):** this application is not deployed, and its
> Supabase schema was retired by
> `supabase/migrations/20261112000200_drop_legacy_cluster.sql` (see
> `docs/supabase-cleanup.md`). The code in root `src/` remains in the
> repository but its database objects no longer exist; the description below
> is retained for reference.

```text
pages / feature subviews
          ↓
feature service functions ← injectable LockerGateway for handoff
          ↓
DataGateway interface
          ↓
Supabase adapter → RLS / transactional database commands / private Storage
```

## Responsibilities

| Module                 | Responsibility                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| `features/auth`        | Fixed-account sign-in, session observation, sign-out                         |
| `features/users`       | Profile, avatar, sprite reads and saves                                      |
| `features/friendships` | Requests, acceptance/rejection, distinct friend IDs                          |
| `features/items`       | Creation, item details/images, category/locker/friend filters                |
| `features/loans`       | Read, create/modify plan, approve, cancel                                    |
| `features/handoff`     | QR provider, simulated scan, separate photo upload and recording             |
| `features/reviews`     | Public review reads, author create/edit/delete, optional image               |
| `features/chats`       | Two-person chat records, summaries, messages, image attachment, subscription |

`core/types.ts` holds the small domain types. `core/mappers.ts` is the only place
that translates database field names to those types. `core/hooks.ts` contains
shared read hooks. `core/query.ts` centralizes which reads need refreshing after
a command; services never call other feature services to refresh their state.
Each query has its own loading/error/retry display. A failed Borrow request does
not prevent Share, Friends or Me from loading.

`core/router.ts` accepts only `/borrow`, `/share`, `/loans`, `/friends`, `/me`.
Loan selection may use `?loan=<id>`; details, conversation and photo capture are
subviews, not additional pages. Session changes clear cached private data.

## Changing one part safely

- **Change the UI:** edit a page/subview while keeping service inputs and outputs.
- **Change storage/backend:** implement `DataGateway` and update the composition
  root. Preserve domain types or change their mapper explicitly.
- **Connect hardware:** implement `LockerGateway` and replace
  `makeSimulatedLocker` in the composition root. The future backend must validate
  hardware events before recording a scan; the current challenge is a demo token.
- **Change loan rules:** add a forward database migration and integration coverage.
  Commands lock records, check the actor and current revision, and reject invalid
  transitions. Client validation is only immediate feedback.
- **Change the return checklist:** update the versioned template in
  `private.prototype_config` through a migration. New loans snapshot the new
  version; existing loans retain their checklist.
- **Change file rules:** update both the file validator and Storage bucket limits.
  Current attachments are JPEG/PNG/WebP, at most 5 MB. General documents are not
  part of this frame.

## Handoff and retries

A scan and a photo are deliberately separate commands. `simulate_locker_scan`
advances custody and returns a pending-photo task. The photo subview opens
automatically for the responsible participant, and reopening the loan resumes it.
Leaving the subview never reverses a scan. `record_handoff_photo` attaches exactly
one image to that task. A pending photo blocks the next scan on the server.

Final owner collection sets Returned/Past before its photo. Review creation and
the next loan's physical dropoff stay blocked until final photo/checklist completion.
Reviews remain optional and their deletion never changes loan status.

Scan challenges are tied to actor, loan revision and step. Replaying a consumed
challenge is idempotent; editing/cancelling invalidates earlier challenges. Photo
recording is idempotent for the same path. The photo form retains an uploaded path
while retrying finalization. Messages use a stable client request ID during retries
to avoid duplicate sends. Failed writes refresh related reads because a timeout
can happen after a successful commit.

## Scope limits

The frame loads up to 1,000 rows per repository read, filters items locally, and
shows the latest 200 chat messages. Add server pagination/search when needed.
Realtime refreshes chat data; other workflows use command refreshes, window-focus
refresh and explicit refresh buttons. Use separate browser profiles for two-account
manual tests because Supabase sessions are shared within an origin's browser storage.

The interface intentionally uses native forms and text. Avatar/item photos coexist
with sprite fields; sprite rendering, physical lockers and general document
attachments are not implemented.
