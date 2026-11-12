begin;
-- Add item identity to the existing safe review projection. Loan records,
-- borrower identity, handover evidence and booking details remain private.
create or replace function public.demo_public_reviews() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',md5(r.loan_id),'ownerId',l.owner_id,'itemId',l.item_id,'review',r.data
 )),'[]')
 from public.demo_reviews r join public.demo_loans l on l.id=r.loan_id
 where public.demo_member();
$$;
revoke all on function public.demo_public_reviews() from public,anon;
grant execute on function public.demo_public_reviews() to authenticated;
commit;
