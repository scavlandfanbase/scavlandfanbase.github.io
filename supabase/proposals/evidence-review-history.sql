-- Unapplied proposal. Deploy the new UI/RPC together; existing direct moderation stops here.
begin;
create schema scavland_evidence_review;
revoke all on schema scavland_evidence_review from public,anon,authenticated,service_role;
create table scavland_evidence_review.reviews (
 submission_id uuid not null references public.evidence_submissions(id),
 version integer not null check(version>0),request_id uuid not null unique,
 actor uuid not null,reviewed_at timestamptz not null default clock_timestamp(),
 previous_status text not null,previous_reviewed_at timestamptz,previous_review_notes text,decision text not null,notes text,
 expected_version integer not null,expected_status text not null,
 primary key(submission_id,version)
);
alter table scavland_evidence_review.reviews enable row level security;
revoke all on scavland_evidence_review.reviews from public,anon,authenticated,service_role;
create function scavland_evidence_review.decide(p_submission uuid,p_request uuid,p_version integer,p_status text,p_decision text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();receipt scavland_evidence_review.reviews;submission public.evidence_submissions;head integer;
begin
 if actor is null or not coalesce(public.has_scavland_permission('evidence_review'),false) then raise sqlstate '42501' using message='Evidence review permission required.';end if;
 if p_submission is null or p_request is null or p_version is null or p_version<0
 or p_status is null or p_status not in ('pending','approved','rejected')
 or p_decision is null or p_decision not in ('pending','approved','rejected')
 or length(p_notes)>4000 then raise sqlstate '22023' using message='Invalid evidence review.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evidence-request:'||p_request::text,0));
 select * into receipt from scavland_evidence_review.reviews where request_id=p_request;
 if found then
  if receipt.actor<>actor or receipt.submission_id<>p_submission or receipt.expected_version<>p_version
  or receipt.expected_status<>p_status or receipt.decision<>p_decision or receipt.notes is distinct from p_notes then
   raise sqlstate 'PT409' using message='Review request changed.';end if;
  return to_jsonb(receipt);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evidence:'||p_submission::text,0));
 select * into submission from public.evidence_submissions where id=p_submission for update;
 if not found then raise sqlstate 'PT409' using message='Submission is no longer available.';end if;
 select coalesce(max(version),0) into head from scavland_evidence_review.reviews where submission_id=p_submission;
 if head<>p_version or submission.status<>p_status then raise sqlstate 'PT409' using message='Evidence review changed. Reload before deciding.';end if;
 if not ((p_status='pending' and p_decision in ('approved','rejected')) or (p_status in ('approved','rejected') and p_decision='pending')) then
  raise sqlstate '22023' using message='Review pending evidence or restore a decision to pending first.';end if;
 insert into scavland_evidence_review.reviews(submission_id,version,request_id,actor,previous_status,previous_reviewed_at,previous_review_notes,decision,notes,expected_version,expected_status)
 values(p_submission,head+1,p_request,actor,p_status,submission.reviewed_at,submission.review_notes,p_decision,p_notes,p_version,p_status) returning * into receipt;
 update public.evidence_submissions set status=p_decision,reviewed_at=receipt.reviewed_at,review_notes=p_notes where id=p_submission;
 return to_jsonb(receipt);
end $$;
revoke all on function scavland_evidence_review.decide(uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
grant usage on schema scavland_evidence_review to authenticated;
grant execute on function scavland_evidence_review.decide(uuid,uuid,integer,text,text,text) to authenticated;
create function public.scavland_review_evidence(p_submission uuid,p_request uuid,p_version integer,p_status text,p_decision text,p_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$select scavland_evidence_review.decide(p_submission,p_request,p_version,p_status,p_decision,p_notes);$$;
revoke all on function public.scavland_review_evidence(uuid,uuid,integer,text,text,text) from public,anon,service_role;
grant execute on function public.scavland_review_evidence(uuid,uuid,integer,text,text,text) to authenticated;
create function public.scavland_evidence_state(p_submission uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare submission public.evidence_submissions;
begin
 if auth.uid() is null or not coalesce(public.has_scavland_permission('evidence_review'),false) then raise sqlstate '42501' using message='Evidence review permission required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evidence:'||p_submission::text,0));
 select * into submission from public.evidence_submissions where id=p_submission;
 if not found then raise sqlstate 'PT409' using message='Submission is no longer available.';end if;
 return jsonb_build_object('submission',to_jsonb(submission),'version',(select coalesce(max(version),0) from scavland_evidence_review.reviews where submission_id=p_submission),
 'history',coalesce((select jsonb_agg(to_jsonb(r) order by version) from scavland_evidence_review.reviews r where submission_id=p_submission),'[]'::jsonb));
end $$;
revoke all on function public.scavland_evidence_state(uuid) from public,anon,service_role;
grant execute on function public.scavland_evidence_state(uuid) to authenticated;
create index evidence_review_queue_order on public.evidence_submissions(status,created_at desc,id desc);
create function public.scavland_evidence_queue(p_status text,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.has_scavland_permission('evidence_review'),false) then raise sqlstate '42501' using message='Evidence review permission required.';end if;
 if p_status is null or p_status not in ('pending','approved','rejected') or (p_before is null)<>(p_before_id is null) then raise sqlstate '22023' using message='Invalid evidence queue.';end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by created_at desc,id desc) from
 (select id,item_name,category,submission_type,status,created_at from public.evidence_submissions
 where status=p_status and (p_before is null or (created_at,id)<(p_before,p_before_id))
 order by created_at desc,id desc limit 30) q),'[]'::jsonb);
end $$;
revoke all on function public.scavland_evidence_queue(text,timestamptz,uuid) from public,anon,service_role;
grant execute on function public.scavland_evidence_queue(text,timestamptz,uuid) to authenticated;
-- Preserve public submission/read policies. Browser moderation must use the audited RPC.
revoke update,delete on public.evidence_submissions from public,anon,authenticated;
commit;
