# Compatible item image integration

## Diagnosis and verified baseline

Fork main and upstream main both resolve to 5b84c479c197a4a2aede1fb864507a22f02d4156. The previous image branch 8f17edf is two commits ahead and 23 behind, with merge base 518361ad39f93762651f1cc61009c9b533406c9e. This branch is based directly on current main; no old branch merge or cherry-pick was used.

Relevant upstream history reviewed through PR descriptions and file lists:
- PR 6 (8f7b006): connected database/auth/state architecture; unchanged here.
- PR 7 (5d2be60): removed unused storage.ts and obsolete assets. They remain deleted.
- PR 8 (96f77e8): formatting and clarified logic; current source remains the starting point.
- PR 9 (c68e1de): camera capture/preview; CameraCapture and LockerFlow remain untouched.
- PR 10 (5b84c47): redesigned ItemCard, ItemDetails, Friends/profile/reviews, avatar editor, shelf rings, sprites and category/availability UI. These structures are retained.

The old BorrowHome contained inline cards; current BorrowHome uses ItemCard with owner strip and availability badge. Restoring the old file would remove those features. The old ItemDetails predates the new hero, chat/view-loan actions, availability and review journey. Restoring old app.css/borrow.css would roll back many team styles. Independently rounding every image to 12px leaves purple recesses at the image-to-info join. This port replaces only item-photo rendering in the current components and keeps both existing main stylesheets untouched.

## Changes and before/after

| Surface | Before | After |
|---|---|---|
| Browse card | Current team owner/Friend strip, photo/category tile, availability and location | Same metadata/actions/spacing; shared photo fallback; 8px outer silhouette, square internal seams |
| Map preview | 6px thumbnail; category map pins | Same 6px thumbnail with shared fallback; category pins unchanged |
| Details | New hero, sprite, chat, availability, review journey | Same structure with shared hero photo; decorative sprite unchanged |
| Share/loan/review item thumbnail | Plain item img | Shared fallback and 8px standalone corners |
| ShelfStrip | Circular status ring with photo/category tile | Same circular ring and badges with box fallback for missing item photos |
| Profile/shared lists | Current profile and friend architecture | Only item thumbnail changed; avatars and networks unchanged |

Added components/ui/ItemImage.tsx and item-image.css. The image component reuses the exact legacy Supabase placeholder matcher from 8f17edf. It preserves genuine sources, dimensions, alt labels and consumer classes. Genuine data and blob URLs are also covered by the source-preservation checks. The source-keyed inner boundary clears error state on source changes, including a return to a previously failed URL. Fallback failures cannot retry indefinitely.

ItemCard retains availabilityLabel, owner avatar/name, Friend badge, location, ARIA label, status icon and click handler. ShelfStrip retains status calculation, circular rings and legend. CategoryIcon remains in map pins, filters and Share metadata. Missing item photos use the box, not a category icon.

Consumer-only edits: ItemCard, ItemDetails, NeighborhoodMap, SharePage, ShelfStrip, PersonProfile, LoanSummary, ReviewSheet, ReviewForm and the remaining FriendsPage item list. Unrelated evidence/review images, camera previews, QR, avatars and decorative TV sprites are unchanged. The TV sprite's embedded image remains governed by the team's sprite component; this task does not alter sprite rendering.

The existing original artwork is copied byte-for-byte from the old branch into public/assets/item-placeholder.png (Git blob ab396a825660a1ee731e3aa34dcb871db3d040f3). No regeneration, Storage write, persisted data change or external image request is required for missing/legacy placeholders.

## Validation

Node 24: npm ci; npm test (57 passed plus connected interaction checks); npm run test:rendered (8 routed views/assets/QR, image fallback/error/source changes, current card metadata and detail-action checks, CSS contract checks for card seams, placeholder containment, circular shelves and map radius); npm run build; git diff --check. No dependency or lockfile change.

Real-browser visual inspection at 320, 375, 410px and desktop remains UNVERIFIED. A fresh isolated Playwright/Chromium launch was attempted, but Chromium terminated before opening a page: process_singleton_posix.cc socket() failed: Operation not permitted. Previously available cloud-browser access was isolated from workspace loopback. No deployment was made for inspection and no screenshots or visually inspected pages are claimed. CSS contracts/static markup verify rules and metadata, not pixel layout or clipping. Review manually before merging: owner strip/photo/info seams, full item names/location, availability badge, keyboard focus outline, shelf status rings and placeholder containment. Use real and legacy placeholder sources at each size. Help remains the current upstream layout; no new thumbnails were added.

## Prepared pull request

Title: Integrate item image polish without reverting the latest team UI

Description: Port the existing box placeholder and shared missing/broken/legacy image handling onto current main 5b84c47. Preserve the redesigned cards, profiles, filters, reviews, camera and connected workflows. Use an 8px card silhouette with square photo/info seams, 6px map thumbnails, and unchanged circular shelf status rings. No backend, auth, persistence, migration, dependency or deployment changes.

Validation: 57 unit tests, connected checks, rendered/image/card/CSS checks and production build pass. Viewport visual acceptance remains outstanding.

Regression checklist:
- Review 320/375/410px and desktop card text, seams, badges and focus indicators.
- Verify real/missing/broken/legacy images in browse/map/details, shelf/profile, loan and review item thumbnails.
- Check category/available-now/friends filters and current chat/loan navigation.
- Confirm avatar editor, shelf rings, review photos, sprite art and locker camera remain unchanged.

No PR was opened. Only the new fork branch is authorized for writes; original image branch and both mains remain unchanged.

## Prepared Telegram message

I've ported the box placeholder and image rounding onto the latest team main, keeping the new cards, owner/friend labels, availability badges, profiles, shelf rings and camera code. Cards now have an 8px outer edge with square photo-to-text seams. Tests and build pass; mobile visual checks still need review. Changes are on my new fork branch only; no team branch or database changes.
