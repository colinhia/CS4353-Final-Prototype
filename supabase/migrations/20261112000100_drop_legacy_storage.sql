--  Priority 1 cleanup: drop the legacy Storage buckets and their policies.
--
-- Audited 2026-11-11 against the live hosted project (see
-- docs/supabase-cleanup.md). The five buckets below were created for the
-- root src/ app (chat photos, item photos, review photos, loan-handover
-- proof photos, and profile avatar photos). The live demo in frontend/
-- uses only the `demo-images` bucket, and the `demo_*` demo chain never
-- references any of these, so dropping them cannot affect the deployed
-- demo.
--
-- Each bucket held 0 objects at audit time. storage.objects has no foreign
-- key that points at a bucket by id in a way that would block a bucket
-- drop, but we still guard against data being added after the audit.
--
-- Order: drop the row-level policies first (they reference the bucket ids),
-- then the buckets themselves.

do $$ begin
  if exists (select 1 from storage.objects
             where bucket_id in (
               'chat-images','item-images','loan-review-images',
               'loan-verification','profile-images')) then
    raise exception 'Legacy storage buckets still contain objects; remove them explicitly first';
  end if;
end $$;

-- storage.objects policies (all scoped to the legacy buckets).
drop policy if exists chat_image_read        on storage.objects;
drop policy if exists chat_image_upload      on storage.objects;
drop policy if exists lending_images_read    on storage.objects;
drop policy if exists lending_images_upload  on storage.objects;
drop policy if exists lending_images_delete  on storage.objects;
drop policy if exists review_image_read      on storage.objects;
drop policy if exists review_image_upload    on storage.objects;
drop policy if exists verification_upload    on storage.objects;
drop policy if exists verification_read      on storage.objects;
drop policy if exists unused_proof_delete    on storage.objects;

-- The five legacy buckets. Supabase protects direct storage deletes behind
-- the storage.allow_delete_query guard (protect_buckets_delete); it is
-- enabled transaction-locally for this statement only.
do $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id in (
    'chat-images','item-images','loan-review-images',
    'loan-verification','profile-images'
  );
end $$;
