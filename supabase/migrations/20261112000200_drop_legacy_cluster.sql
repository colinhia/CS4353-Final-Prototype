--  Priority 2 cleanup: retire the legacy (root src/ app) schema cluster.
--
-- Audited 2026-11-11 against the live hosted project (see
-- docs/supabase-cleanup.md). Everything dropped here was used exclusively by
-- the undeployed root src/ application. The live demo in frontend/ touches
-- none of it except two objects that are deliberately KEPT:
--  * private.valid_face_strokes(jsonb) -- called by demo_update_sprite.
--  * the public.sprite_colour enum type -- demo_update_sprite validates
--    colours against enum_range(null::public.sprite_colour).
-- Dropping public.sprites does not drop the type; types live in their own
-- namespace. The btree_gist extension is also kept: demo_loans'
-- demo_no_overlap exclusion constraint still needs it.
--
-- The objects below form one self-contained foreign-key cluster, so they are
-- dropped together. Order matters:
--  1. Triggers (they pin their functions; on_auth_user_created also stops
--     new legacy profiles rows from being created for auth users).
--  2. Realtime publication entry for public.messages (the only legacy table
--     in supabase_realtime; all demo_* tables stay).
--  3. Views (they pin functions and tables).
--  4. Functions, in dependency order. Three of them use a legacy table row
--     type as an argument or result (public.loans, public.items,
--     public.reviews), so they must go before the table drops.
--     The row-level policies are dropped explicitly in step 3.5: one of
--     them calls a function being dropped (messages_participants ->
--     private.chat_member), and the sprites/item_images/loans policies
--     reference sibling legacy tables, which would block table drops that
--     come before their own table in step 5 (e.g. items before sprites).
--  5. Tables, children before parents (indexes and policies drop with them).
--
-- Data: at audit time every legacy table was empty except public.profiles
-- (8 rows, one per root-app user), public.sprites (8) and public.lockers
-- (10 seeded names) -- all root-app data. The root app is being retired
-- (user decision, 2026-11-11), so those rows are intentionally discarded;
-- the live demo never reads them (its lockers are hardcoded strings and its
-- people live in demo_profiles). Snapshot first if the rows are wanted.

begin;

-- 1. Triggers.
drop trigger if exists items_assign_sprite on public.items;
drop trigger if exists items_remove_sprite on public.items;
drop trigger if exists profiles_assign_sprite on public.profiles;
drop trigger if exists profiles_remove_sprite on public.profiles;
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Realtime.
do $$ begin
  if exists(select 1 from pg_publication_tables
            where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime drop table public.messages;
  end if;
end $$;

-- 3. Views.
drop view if exists public.loan_catalog;
drop view if exists public.item_catalog;

-- 3.5. All row-level policies on the legacy tables. Dropped explicitly so
-- the table drops below cannot be blocked by sibling-table or function
-- references inside a policy (the FK-safe table order cannot satisfy the
-- sprites -> items/profiles policy references).
drop policy if exists profiles_read         on public.profiles;
drop policy if exists profiles_edit         on public.profiles;
drop policy if exists friendships_read      on public.friendships;
drop policy if exists friendships_request   on public.friendships;
drop policy if exists friendships_accept    on public.friendships;
drop policy if exists friendships_remove    on public.friendships;
drop policy if exists items_read            on public.items;
drop policy if exists items_insert          on public.items;
drop policy if exists items_edit            on public.items;
drop policy if exists items_delete          on public.items;
drop policy if exists item_images_read      on public.item_images;
drop policy if exists item_images_insert    on public.item_images;
drop policy if exists item_images_delete    on public.item_images;
drop policy if exists loans_read            on public.loans;
drop policy if exists loans_colour_edit     on public.loans;
drop policy if exists sprites_read          on public.sprites;
drop policy if exists sprites_edit          on public.sprites;
drop policy if exists chats_read            on public.chats;
drop policy if exists chats_insert          on public.chats;
drop policy if exists lockers_read          on public.lockers;
drop policy if exists item_lockers_read     on public.item_lockers;
drop policy if exists reviews_participants  on public.reviews;
drop policy if exists messages_participants on public.messages;

-- 4. Functions.
-- 4a. Row-type functions first: their signatures reference public.loans,
-- public.items or public.reviews, so the table drops below would be blocked.
drop function if exists private.pending_photo(public.loans);
drop function if exists private.next_scan(public.loans);
drop function if exists private.step_actor(public.loans, text);
drop function if exists public.simulate_locker_scan(uuid);
drop function if exists public.create_loan(uuid, date, date, integer);
drop function if exists public.modify_loan(uuid, date, date, integer, integer);
drop function if exists public.approve_loan(uuid, integer);
drop function if exists public.cancel_loan(uuid, integer);
drop function if exists public.record_handoff_photo(uuid, text, text, text[]);
drop function if exists public.save_review(uuid, text, text[], text);
drop function if exists public.save_review_v2(uuid, text, text[], integer, text);
drop function if exists public.get_reviews(uuid, uuid);
drop function if exists private.item_compliments(uuid);
drop function if exists private.item_status(uuid);
-- 4b. The remaining legacy commands and private helpers.
-- private.valid_face_strokes is deliberately NOT dropped (demo_update_sprite).
drop function if exists public.create_item(text, text, text[], integer[]);
drop function if exists public.set_item_lockers(uuid, integer[]);
drop function if exists public.get_handoff_qr(uuid, integer);
drop function if exists public.delete_review(uuid);
drop function if exists public.send_message(uuid, text, uuid, text);
drop function if exists public.get_chat_summaries();
drop function if exists private.assign_sprite();
drop function if exists private.remove_sprite();
drop function if exists private.create_profile();
drop function if exists private.can_view_owner(uuid);
drop function if exists private.item_on_loan(uuid);
drop function if exists private.loan_owner(uuid);
drop function if exists private.is_friend(uuid, uuid);
drop function if exists private.chat_member(uuid);
drop function if exists private.can_upload_verification(text);
drop function if exists private.review_image_visible(text);
drop function if exists private.palette_colour_for(uuid);

-- 5. Tables (children before parents; their indexes, policies and FK
-- constraints go with them).
drop table if exists public.messages;
drop table if exists public.reviews;
drop table if exists private.handoff_challenges;
drop table if exists public.item_images;
drop table if exists public.item_lockers;
drop table if exists public.loans;
drop table if exists public.chats;
drop table if exists public.friendships;
drop table if exists public.items;
drop table if exists public.lockers;
drop table if exists public.profiles;
drop table if exists public.sprites;
drop table if exists private.prototype_config;

commit;

--  Post-drop sanity check: fail loudly if any legacy object survived or a
-- kept demo dependency is missing.
do $$ declare n int; begin
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname in ('public','private') and c.relkind in ('r','v','m') and c.relname in (
    'profiles','sprites','items','item_images','item_lockers','loans','lockers',
    'chats','messages','reviews','friendships','item_catalog','loan_catalog',
    'handoff_challenges','prototype_config');
  if n > 0 then raise exception 'legacy cluster objects survived the drop: %', n; end if;
  if not exists(select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
                where ns.nspname='private' and p.proname='valid_face_strokes')
    or not exists(select 1 from pg_type t join pg_namespace ns on ns.oid=t.typnamespace
                  where ns.nspname='public' and t.typname='sprite_colour') then
    raise exception 'kept demo dependency (valid_face_strokes or sprite_colour) is missing';
  end if;
end $$;
