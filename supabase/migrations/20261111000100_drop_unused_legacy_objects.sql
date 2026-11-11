--  Tier 1 cleanup: drop legacy objects with zero references in the final schema.
--
-- Audited 2026-11-11 (see docs/supabase-cleanup.md). Each object below was
-- created by an early migration and is not read, written, granted, or
-- referenced by any later migration, view, policy, trigger, function, or
-- client code (frontend/ or the root src/ app):
--  * public.user_compliments (view, 20261030000200) -- only its own grants.
--  * public.user_locations (view, 20261030000200) -- replaced a same-named
--    table dropped in the same migration; the final item_catalog and
--    loan_catalog do not use it.
--  * public.item_locations (table, 20261030000200) -- its only consumer was
--    the user_locations view above; no foreign key points at it.
--  * private.record_loan_verification() (trigger function, 20261030000200)
--    -- its only caller, trigger record_lending_verification, was dropped by
--    20261030000300.
--
-- Order matters: the user_locations view selects from item_locations, so the
-- views go first. Nothing in the live demo (demo_* objects) depends on any of
-- these.

-- Refuse to silently discard location rows, matching the guard 20261030000200
-- used when it dropped the original user_locations table.
do $$ begin
  if exists (select 1 from public.item_locations) then
    raise exception 'item_locations rows require an explicit data migration';
  end if;
end $$;

drop view public.user_compliments;
drop view public.user_locations;
drop table public.item_locations;
drop function private.record_loan_verification();
