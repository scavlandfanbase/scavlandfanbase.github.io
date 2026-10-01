-- Unapplied; after page-builder-read.sql. Recovery proof is supplied only by
-- trusted Git reconciliation, never browser metadata. No network under DB locks.
begin;
create table scavland_pages.git_recovery (
 request_id uuid primary key references scavland_pages.publications(request_id),
 fence jsonb not null,attempt_id uuid,created_at timestamptz not null default clock_timestamp()
);
alter table scavland_pages.git_recovery enable row level security;
revoke all on scavland_pages.git_recovery from public,anon,authenticated,service_role;
create function scavland_pages.page_recovery(p_request uuid,p_attempt uuid,p_action text,p_fence jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare publication scavland_pages.publications;candidate_row scavland_pages.git_candidates;existing scavland_pages.git_recovery;
begin
 if p_request is null or p_attempt is null or p_action is null or p_action not in ('prepare','claim','confirm','cancel-unprepared') then raise sqlstate '22023' using message='Invalid recovery operation.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-publish-request:'||p_request::text,0));
 select * into publication from scavland_pages.publications where request_id=p_request;
 if not found or publication.state not in ('prepared','refused') then raise sqlstate 'PT409' using message='Recovery no longer applies.';end if;
 if p_action='cancel-unprepared' then
  if p_fence is not null or exists(select 1 from scavland_pages.git_candidates where request_id=p_request) then raise sqlstate 'PT409' using message='Candidate may already dispatch.';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
  update scavland_pages.publications set state='refused',updated_at=clock_timestamp() where request_id=p_request returning * into publication;return to_jsonb(publication);
 end if;
 select * into candidate_row from scavland_pages.git_candidates where request_id=p_request;
 if not found then raise sqlstate 'PT409' using message='Durable candidate missing.';end if;
 if p_fence is null or jsonb_typeof(p_fence)<>'object' or (select count(*) from jsonb_object_keys(p_fence))<>4
 or p_fence->>'requestId' is distinct from p_request::text
 or p_fence->>'baseHead' is distinct from candidate_row.candidate->>'baseHead'
 or p_fence->>'candidateCommit' is distinct from candidate_row.candidate->>'commit'
 or jsonb_typeof(p_fence->'commit') is distinct from 'string' or coalesce(p_fence->>'commit','') !~ '^[a-f0-9]{40}$'
 or p_fence->>'commit'=candidate_row.candidate->>'commit' then raise sqlstate '22023' using message='Invalid recovery fence.';end if;
 select * into existing from scavland_pages.git_recovery where request_id=p_request;
 if p_action='prepare' then
  if found then
   if existing.fence<>p_fence then raise sqlstate 'PT409' using message='Recovery fence cannot change.';end if;
   return existing.fence;
  end if;
  if publication.state<>'prepared' then raise sqlstate 'PT409' using message='Publication already resolved.';end if;
  insert into scavland_pages.git_recovery(request_id,fence) values(p_request,p_fence);return p_fence;
 end if;
 if not found or existing.fence<>p_fence then raise sqlstate 'PT409' using message='Durable recovery fence missing.';end if;
 if p_action='claim' then
  if existing.attempt_id is not null or publication.state<>'prepared' then return jsonb_build_object('acquired',false);end if;
  update scavland_pages.git_recovery set attempt_id=p_attempt where request_id=p_request;return jsonb_build_object('acquired',true);
 end if;
 if existing.attempt_id is null then raise sqlstate 'PT409' using message='Recovery was not dispatched.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 -- Fence ancestry has been confirmed by the service. The original sibling can
 -- no longer fast-forward main. Terminal refusal also prevents new claims.
 update scavland_pages.publications set state='refused',updated_at=clock_timestamp() where request_id=p_request returning * into publication;
 return to_jsonb(publication);
end;$$;
revoke all on function scavland_pages.page_recovery(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.page_recovery(uuid,uuid,text,jsonb) to service_role;
create function public.scavland_page_recovery(p_request uuid,p_attempt uuid,p_action text,p_fence jsonb)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.page_recovery(p_request,p_attempt,p_action,p_fence);$$;
revoke all on function public.scavland_page_recovery(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.scavland_page_recovery(uuid,uuid,text,jsonb) to service_role;
commit;
