-- Unapplied; after page-builder-publication.sql. No Git call in this transaction.
begin;
create table scavland_pages.git_candidates (
 request_id uuid primary key references scavland_pages.publications(request_id),
 candidate jsonb not null,created_at timestamptz not null default clock_timestamp()
);
alter table scavland_pages.git_candidates enable row level security;
revoke all on scavland_pages.git_candidates from public,anon,authenticated,service_role;
create function scavland_pages.prepare_git_candidate(p_request uuid,p_candidate jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_pages.publications;preview_row scavland_pages.previews;existing scavland_pages.git_candidates;
begin
 if p_request is null or p_candidate is null or jsonb_typeof(p_candidate)<>'object'
 or octet_length(p_candidate::text)>2048 or (select count(*) from jsonb_object_keys(p_candidate))<>6
 or p_candidate->>'requestId' is distinct from p_request::text
 or jsonb_typeof(p_candidate->'requestId') is distinct from 'string'
 or jsonb_typeof(p_candidate->'commit') is distinct from 'string' or coalesce(p_candidate->>'commit','') !~ '^[a-f0-9]{40}$'
 or jsonb_typeof(p_candidate->'tree') is distinct from 'string' or coalesce(p_candidate->>'tree','') !~ '^[a-f0-9]{40}$'
 or jsonb_typeof(p_candidate->'baseHead') is distinct from 'string'
 or jsonb_typeof(p_candidate->'digest') is distinct from 'string'
 or jsonb_typeof(p_candidate->'path') is distinct from 'string' then
  raise sqlstate '22023' using message='Invalid Git candidate.';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-publish-request:'||p_request::text,0));
 select * into receipt from scavland_pages.publications where request_id=p_request;
 if not found then raise sqlstate 'PT409' using message='Publication reservation missing.';end if;
 select * into preview_row from scavland_pages.previews where request_id=receipt.preview_id;
 if p_candidate->>'baseHead' is distinct from preview_row.preview->>'baseHead'
 or p_candidate->>'digest' is distinct from preview_row.preview->>'digest'
 or p_candidate->>'path' is distinct from preview_row.preview->>'path' then
  raise sqlstate 'PT409' using message='Candidate does not match reviewed publication.';
 end if;
 select * into existing from scavland_pages.git_candidates where request_id=p_request;
 if found then
  if existing.candidate<>p_candidate then raise sqlstate 'PT409' using message='Publication candidate cannot change.';end if;
  return existing.candidate;
 end if;
 if receipt.state<>'prepared' then raise sqlstate 'PT409' using message='Publication is already committed.';end if;
 insert into scavland_pages.git_candidates(request_id,candidate) values(p_request,p_candidate);
 return p_candidate;
end;$$;
revoke all on function scavland_pages.prepare_git_candidate(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.prepare_git_candidate(uuid,jsonb) to service_role;
create function public.scavland_prepare_page_git_candidate(p_request uuid,p_candidate jsonb)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.prepare_git_candidate(p_request,p_candidate);$$;
revoke all on function public.scavland_prepare_page_git_candidate(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.scavland_prepare_page_git_candidate(uuid,jsonb) to service_role;
create function scavland_pages.guard_git_candidate()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.commit_sha is not null and not exists(select 1 from scavland_pages.git_candidates
 where request_id=new.request_id and candidate->>'commit'=new.commit_sha) then
  raise sqlstate 'PT409' using message='Commit evidence does not match durable candidate.';
 end if;
 return new;
end;$$;
revoke all on function scavland_pages.guard_git_candidate() from public,anon,authenticated,service_role;
create trigger page_commit_candidate before update of commit_sha on scavland_pages.publications
for each row execute function scavland_pages.guard_git_candidate();
commit;
