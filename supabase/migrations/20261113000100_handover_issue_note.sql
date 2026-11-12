begin;
-- Handover issue reporting: record-proof accepts an optional issue note that is
-- stored with the handover photo and surfaced under the loan's handover photos.
create or replace function public.demo_command_base(command jsonb,request_id uuid,expected_revision integer default null) returns void
language plpgsql security definer set search_path='' as $$
<<cmd>>
declare actor uuid:=auth.uid(); kind text:=command->>'type'; target text:=coalesce(command->>'loanId',command->>'id'); l public.demo_loans; i public.demo_items; f public.demo_friendships; person public.demo_profiles;
start_day date; end_day date; step text; next_step text; assigned uuid; photo text; issue_note text; prior jsonb; now_text text:=clock_timestamp()::text; body text; other uuid; existing jsonb; stage text;
begin
if not public.demo_member() then raise exception 'Sign in with an assigned demo account.'; end if;
if request_id is null then raise exception 'Request ID required.'; end if;
perform pg_advisory_xact_lock(hashtextextended(actor::text||request_id::text,0));
select payload into existing from public.demo_requests where demo_requests.actor=auth.uid() and id=request_id;
if found then if existing is distinct from command then raise exception 'Request ID already used.'; end if; return; end if;
select * into person from public.demo_profiles where id=actor;
if kind in('edit-plan','approve-plan','cancel-loan','decline-loan','record-proof','verify-condition','resolve-condition','submit-review','edit-review') then
select * into l from public.demo_loans where id=target for update;
if l.id is null or actor not in(l.owner_id,l.borrower_id) then raise exception 'Only a loan participant can do this.'; end if;
if expected_revision is distinct from l.revision then raise exception 'This loan changed. Refresh and review it before trying again.'; end if;
end if;
if kind in('request-loan','edit-plan') then
start_day:=(command->>'start')::date; end_day:=(command->>'end')::date;
if start_day is null or end_day is null or not isfinite(start_day) or not isfinite(end_day) or start_day<(now() at time zone 'Asia/Singapore')::date or end_day<start_day then raise exception 'Choose valid receive and return dates.'; end if;
if coalesce(command->>'lockerId','') not in('clementi','toa-payoh','kent-ridge') then raise exception 'Choose a locker location.'; end if;
end if;
case kind
when 'request-loan' then
select * into i from public.demo_items where id=command->>'itemId' for update;
if i.id is null or not (i.data->>'listed')::boolean or i.owner_id=actor then raise exception 'This item is not available to borrow.'; end if;
insert into public.demo_loans values(target,i.id,i.owner_id,actor,start_day,end_day,'requested',jsonb_build_object('lockerId',command->>'lockerId','code',upper(substr(gen_random_uuid()::text,1,8)),'createdAt',now_text),1);
insert into public.demo_approvals values(target,actor);
perform public.demo_notify(i.owner_id,(person.data->>'name')||' requested '||(i.data->>'name')||'.',target);
when 'edit-plan' then
if l.status not in('requested','arranging','ready') or exists(select 1 from public.demo_proofs where loan_id=l.id) then raise exception 'The exchange plan can no longer be edited.'; end if;
if l.starts_on=start_day and l.ends_on=end_day and l.data->>'lockerId'=command->>'lockerId' then return; end if;
update public.demo_loans set starts_on=start_day,ends_on=end_day,status='arranging',data=jsonb_set(data,'{lockerId}',command->'lockerId'),revision=revision+1 where id=l.id;
delete from public.demo_approvals where loan_id=l.id; insert into public.demo_approvals values(l.id,actor);
perform public.demo_notify(case when actor=l.owner_id then l.borrower_id else l.owner_id end,(person.data->>'name')||' proposed a new exchange plan.',l.id);
when 'approve-plan' then
if l.status not in('requested','arranging','ready') or exists(select 1 from public.demo_proofs where loan_id=l.id) or (l.status='requested' and actor<>l.owner_id) then raise exception 'This plan cannot be approved.'; end if;
insert into public.demo_approvals values(l.id,actor) on conflict do nothing;
update public.demo_loans set status=case when (select count(*) from public.demo_approvals where loan_id=l.id)=2 then 'ready' else 'arranging' end,revision=revision+1 where id=l.id;
perform public.demo_notify(case when actor=l.owner_id then l.borrower_id else l.owner_id end,(person.data->>'name')||' approved the exchange plan.',l.id);
when 'cancel-loan','decline-loan' then
if l.status not in('requested','arranging','ready') or exists(select 1 from public.demo_proofs where loan_id=l.id) or (kind='decline-loan' and (actor<>l.owner_id or l.status<>'requested')) then raise exception 'This loan cannot be cancelled or declined now.'; end if;
stage:=case kind when 'cancel-loan' then 'cancelled' else 'declined' end;
update public.demo_loans set status=stage,revision=revision+1 where id=l.id;
perform public.demo_notify(case when actor=l.owner_id then l.borrower_id else l.owner_id end,(person.data->>'name')||' '||stage||' the loan.',l.id);
when 'record-proof' then
select x into next_step from unnest(array['ownerDropoff','borrowerPickup','borrowerDropoff','ownerPickup']) with ordinality as steps(x,n) where not exists(select 1 from public.demo_proofs where loan_id=l.id and demo_proofs.step=x) order by n limit 1;
step:=command->>'step'; assigned:=case when step in('ownerDropoff','ownerPickup') then l.owner_id else l.borrower_id end;
if l.status not in('ready','active','returning') or next_step is distinct from step or assigned<>actor then raise exception 'Only the next participant can complete this handover.'; end if;
if command->>'code' is distinct from 'CS4353:'||l.id||':'||step||':'||(l.data->>'code') then raise exception 'That code does not match this handover.'; end if;
if coalesce(command->>'assignmentVerified','')<>'true' then raise exception 'The locker scan must be completed before recording a handover.'; end if;
if coalesce(command->>'lockerNumber','') !~ '^[0-9]{1,2}$' or (command->>'lockerNumber')::int<1 then raise exception 'The locker scan did not assign a valid locker.'; end if;
photo:=command->>'photo'; if photo is null or not public.demo_image_allowed(photo,l.id) or photo like '/assets/%' then raise exception 'Upload an item photo first.'; end if;
issue_note:=btrim(coalesce(command->>'issueNote','')); if issue_note<>'' and (length(issue_note)<5 or length(issue_note)>2000) then raise exception 'Describe the issue in at least 5 and at most 2000 characters.'; end if;
insert into public.demo_proofs values(l.id,step,actor,jsonb_strip_nulls(jsonb_build_object('at',now_text,'photo',photo,'lockerNumber',command->>'lockerNumber','issueNote',nullif(issue_note,''))));
update public.demo_loans set status=case step when 'ownerDropoff' then 'ready' when 'borrowerPickup' then 'active' when 'borrowerDropoff' then 'returning' else 'verifying' end,revision=revision+1 where id=l.id;
perform public.demo_notify(case when actor=l.owner_id then l.borrower_id else l.owner_id end,case when issue_note<>'' then (person.data->>'name')||' completed a handover and reported an item issue.' else (person.data->>'name')||' completed a handover.' end,l.id);
when 'verify-condition' then
if actor<>l.owner_id or l.status<>'verifying' or coalesce(command->>'condition','') not in('good','issue') then raise exception 'Only the owner can verify this returned item.'; end if;
if exists(select 1 from public.demo_conditions where loan_id=l.id) then raise exception 'Resolve the recorded issue instead.'; end if;
if command->>'condition'='issue' and length(btrim(coalesce(command->>'note','')))<5 then raise exception 'Describe the condition issue.'; end if;
insert into public.demo_conditions values(l.id,jsonb_build_object('result',command->>'condition','note',left(btrim(command->>'note'),2000),'at',now_text));
update public.demo_loans set status=case when command->>'condition'='good' then 'complete' else 'verifying' end,revision=revision+1 where id=l.id;
perform public.demo_notify(l.borrower_id,'The owner updated the return condition.',l.id);
when 'resolve-condition' then
if actor<>l.owner_id or l.status<>'verifying' or not exists(select 1 from public.demo_conditions where loan_id=l.id and data->>'result'='issue') then raise exception 'Only the owner can resolve this issue.'; end if;
if length(btrim(coalesce(command->>'note','')))<5 then raise exception 'Add a short resolution note.'; end if;
update public.demo_conditions set data=jsonb_set(data,'{resolution}',to_jsonb(left(btrim(command->>'note'),2000))) where loan_id=l.id;
update public.demo_loans set status='complete',revision=revision+1 where id=l.id;
perform public.demo_notify(l.borrower_id,'The condition issue has been resolved.',l.id);
when 'submit-review','edit-review' then
if actor<>l.borrower_id or l.status<>'complete' then raise exception 'Only the borrower can review a completed loan.'; end if;
if coalesce(command->>'rating','') !~ '^[1-5]$' or length(btrim(coalesce(command->>'text',''))) not between 1 and 2000 then raise exception 'Choose a rating and write a review of up to 2000 characters.'; end if;
if jsonb_typeof(command->'compliments') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(command->'compliments') x where x not in('Great communication','Easy collection','As described')) then raise exception 'Choose a valid compliment.'; end if;
if command ? 'photo' and not public.demo_image_allowed(command->>'photo') and not (kind='edit-review' and exists(select 1 from public.demo_reviews where loan_id=l.id and data->>'photo'=command->>'photo')) then raise exception 'Upload the review photo first.'; end if;
if (kind='edit-review') is distinct from exists(select 1 from public.demo_reviews where loan_id=l.id) then raise exception 'Create a review before editing, and submit each review only once.'; end if;
if kind='edit-review' then delete from public.demo_reviews where loan_id=l.id; end if;
insert into public.demo_reviews values(l.id,jsonb_strip_nulls(jsonb_build_object('rating',(command->>'rating')::int,'text',btrim(command->>'text'),'compliments',command->'compliments','photo',command->>'photo','at',now_text)));
update public.demo_loans set revision=revision+1 where id=l.id;
perform public.demo_notify(l.owner_id,(person.data->>'name')||' left a review.',l.id);
when 'create-item','edit-item' then
if length(btrim(coalesce(command->>'name',''))) not between 1 and 100 or length(btrim(coalesce(command->>'description',''))) not between 1 and 2000 then raise exception 'Enter an item name and description.'; end if;
if coalesce(command->>'category','') not in('Home','Electronics','Party Supplies','Outdoors','Clothing','Tools','Sports') or coalesce(command->>'location','') not in('Clementi','Toa Payoh','Kent Ridge') then raise exception 'Choose a valid category and community.'; end if;
if jsonb_typeof(command->'images') is distinct from 'array' or jsonb_array_length(command->'images')>4 or exists(select 1 from jsonb_array_elements_text(command->'images') x where not public.demo_image_allowed(x) and not exists(select 1 from public.demo_items where id=target and owner_id=actor and data->'images' ? x)) then raise exception 'Choose valid listing photos.'; end if;
prior:=jsonb_build_object('name',btrim(command->>'name'),'title',btrim(command->>'name'),'description',btrim(command->>'description'),'category',command->>'category','location',command->>'location','owner',person.data->>'name','images',case when jsonb_array_length(command->'images')=0 then '["/assets/item-placeholder.png"]'::jsonb else command->'images' end,'image',coalesce(command->'images'->>0,'/assets/item-placeholder.png'),'isFriend',false);
if kind='create-item' then insert into public.demo_items values(target,actor,prior||'{"listed":true}',1);
else select * into i from public.demo_items where id=target for update; if i.owner_id is distinct from actor or i.revision is distinct from expected_revision then raise exception 'Listing changed or is not yours. Refresh before editing.'; end if;
update public.demo_items set data=prior||jsonb_build_object('listed',i.data->'listed'),revision=revision+1 where id=target; end if;
when 'toggle-item' then
select * into i from public.demo_items where id=target for update;
if i.owner_id is distinct from actor or i.revision is distinct from expected_revision then raise exception 'Listing changed or is not yours. Refresh before editing.'; end if;
update public.demo_items set data=jsonb_set(data,'{listed}',to_jsonb(not (data->>'listed')::boolean)),revision=revision+1 where id=target;
when 'request-friend' then
other:=(command->>'to')::uuid; if other=actor then raise exception 'Choose another person.'; end if;
insert into public.demo_friendships values(target,actor,other,'pending'); perform public.demo_notify(other,(person.data->>'name')||' sent you a friend request.');
when 'accept-friend','decline-friend','remove-friend' then
select * into f from public.demo_friendships where id=target for update;
if f.id is null or actor not in(f.sender,f.recipient) then raise exception 'This friendship is unavailable.'; end if;
if kind='accept-friend' then if f.recipient<>actor or f.status<>'pending' then raise exception 'Only the recipient can accept a pending request.'; end if;
update public.demo_friendships set status='accepted' where id=target; perform public.demo_notify(f.sender,(person.data->>'name')||' accepted your friend request.');
else if kind='decline-friend' and f.status<>'pending' then raise exception 'This request was already accepted.'; end if; delete from public.demo_friendships where id=target; end if;
when 'update-profile' then
select * into person from public.demo_profiles where id=actor for update;
if person.revision is distinct from expected_revision then raise exception 'Your profile changed. Refresh before editing.'; end if;
if length(btrim(coalesce(command->>'name',''))) not between 1 and 80 or lower(coalesce(command->>'username','')) !~ '^[a-z0-9_]{3,24}$' or length(coalesce(command->>'bio',''))>500 or coalesce(command->>'location','') not in('Clementi','Toa Payoh','Kent Ridge') then raise exception 'Check your profile name, username, bio and community.'; end if;
if command ? 'avatar' and not public.demo_image_allowed(command->>'avatar') and command->>'avatar' is distinct from person.data->>'avatar' then raise exception 'Upload your avatar first.'; end if;
update public.demo_profiles set data=(data-'avatar')||jsonb_strip_nulls(jsonb_build_object('name',btrim(command->>'name'),'username',lower(command->>'username'),'location',command->>'location','bio',btrim(command->>'bio'),'avatar',command->>'avatar')),revision=revision+1 where id=actor;
when 'send-message' then
other:=(command->>'to')::uuid; body:=btrim(command->>'text'); if other=actor or coalesce(length(body),0) not between 1 and 2000 then raise exception 'Write a message to another person (up to 2000 characters).'; end if;
if command ? 'loanId' and not exists(select 1 from public.demo_loans where id=command->>'loanId' and actor in(owner_id,borrower_id) and other in(owner_id,borrower_id)) then raise exception 'Only loan participants can discuss this loan.'; end if;
insert into public.demo_messages values(request_id::text,actor,other,jsonb_strip_nulls(jsonb_build_object('text',body,'at',now_text,'read',false,'loanId',command->>'loanId')));
perform public.demo_notify(other,(person.data->>'name')||' sent you a message.',null,actor);
when 'read-thread' then
other:=(command->>'peerId')::uuid;
update public.demo_messages set data=jsonb_set(data,'{read}','true') where recipient=actor and sender=other and data->>'read'='false';
update public.demo_notices set data=jsonb_set(data,'{read}','true') where recipient=actor and data->>'peerId'=other::text and data->>'read'='false';
when 'read-notices' then
update public.demo_notices set data=jsonb_set(data,'{read}','true') where recipient=actor and (not(command ? 'id') or id=target) and data->>'read'='false';
else raise exception 'This action is not available.';
end case;
insert into public.demo_requests values(actor,request_id,command);
end $$;

commit;
