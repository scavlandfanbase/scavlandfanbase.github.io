-- Unapplied; after page-builder-storage.sql. No live route or Git write here.
begin;
create table scavland_pages.previews (
 request_id uuid primary key,actor uuid not null,page_id uuid not null,version integer not null,
 preview jsonb not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(page_id,version) references scavland_pages.versions(page_id,version)
);
create table scavland_pages.publications (
 request_id uuid primary key,actor uuid not null,page_id uuid not null,
 preview_id uuid not null references scavland_pages.previews(request_id),
 state text not null default 'prepared' check(state in ('prepared','committed','build-failed','live')),
 commit_sha text,build_run text,created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create unique index page_one_pending_publication on scavland_pages.publications(page_id) where state not in ('live','refused');
create table scavland_pages.publication_events (
 event_id uuid primary key,request_id uuid not null references scavland_pages.publications(request_id),
 event jsonb not null,outcome jsonb not null,recorded_at timestamptz not null default clock_timestamp()
);
alter table scavland_pages.previews enable row level security;
alter table scavland_pages.publications enable row level security;
alter table scavland_pages.publication_events enable row level security;
revoke all on scavland_pages.previews,scavland_pages.publications,scavland_pages.publication_events from public,anon,authenticated,service_role;

create function scavland_pages.prepare_preview(p_actor uuid,p_request uuid,p_page uuid,p_version integer,p_preview jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_pages.previews;current_row scavland_pages.versions;
begin
 if p_actor is null or p_request is null or p_page is null or p_version is null or p_version<1
 or p_preview is null or jsonb_typeof(p_preview)<>'object' or octet_length(p_preview::text)>2097152
 or p_preview->>'pageId' is distinct from p_page::text or p_preview->'version' is distinct from to_jsonb(p_version)
 or coalesce(p_preview->>'digest','') !~ '^[a-f0-9]{64}$' or coalesce(p_preview->>'styleDigest','') !~ '^[a-f0-9]{64}$'
 or coalesce(p_preview->>'baseHead','') !~ '^[a-f0-9]{40}$'
 or jsonb_typeof(p_preview->'digest') is distinct from 'string' or jsonb_typeof(p_preview->'styleDigest') is distinct from 'string'
 or jsonb_typeof(p_preview->'baseHead') is distinct from 'string' or jsonb_typeof(p_preview->'path') is distinct from 'string'
 or jsonb_typeof(p_preview->'html') is distinct from 'string'
 or jsonb_typeof(p_preview->'manifest') is distinct from 'object'
 or (select count(*) from jsonb_object_keys(p_preview))<>8 then raise sqlstate '22023' using message='Invalid trusted page preview.';end if;
 if encode(pg_catalog.sha256(convert_to(p_preview->>'html','UTF8')),'hex')<>p_preview->>'digest' then
  raise sqlstate '22023' using message='Preview output digest mismatch.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-preview-request:'||p_request::text,0));
 select * into receipt from scavland_pages.previews where request_id=p_request;
 if found then
  if receipt.actor<>p_actor or receipt.page_id<>p_page or receipt.version<>p_version or receipt.preview<>p_preview then
   raise sqlstate 'PT409' using message='Preview request reused with different output.';end if;
  return to_jsonb(receipt);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 select * into current_row from scavland_pages.versions where page_id=p_page order by version desc limit 1;
 if current_row.version is distinct from p_version or current_row.archived
 or p_preview->>'path' is distinct from 'pages/'||(current_row.payload->>'slug')||'/index.html' then
  raise sqlstate 'PT409' using message='Saved page changed before preview.';end if;
 insert into scavland_pages.previews(request_id,actor,page_id,version,preview) values(p_request,p_actor,p_page,p_version,p_preview) returning * into receipt;
 return to_jsonb(receipt);
end;$$;
revoke all on function scavland_pages.prepare_preview(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.prepare_preview(uuid,uuid,uuid,integer,jsonb) to service_role;
create function public.scavland_prepare_page_preview(p_actor uuid,p_request uuid,p_page uuid,p_version integer,p_preview jsonb)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.prepare_preview(p_actor,p_request,p_page,p_version,p_preview);$$;
revoke all on function public.scavland_prepare_page_preview(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.scavland_prepare_page_preview(uuid,uuid,uuid,integer,jsonb) to service_role;

create function scavland_pages.reserve_publication(p_request uuid,p_preview uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();receipt scavland_pages.publications;preview_row scavland_pages.previews;current_row scavland_pages.versions;
begin
 if actor is null or not coalesce(public.is_scavland_owner(),false) then raise sqlstate '42501' using message='Owner publication permission required.';end if;
 if p_request is null or p_preview is null then raise sqlstate '22023' using message='Publication request required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-publish-request:'||p_request::text,0));
 if not coalesce(public.is_scavland_owner(),false) then raise sqlstate '42501' using message='Owner publication permission required.';end if;
 select * into receipt from scavland_pages.publications where request_id=p_request;
 if found then
  if receipt.actor<>actor or receipt.preview_id<>p_preview then raise sqlstate 'PT409' using message='Publication request reused.';end if;
  return to_jsonb(receipt);
 end if;
 select * into preview_row from scavland_pages.previews where request_id=p_preview;
 if not found or preview_row.actor<>actor then raise sqlstate '42501' using message='Own reviewed preview required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 if not coalesce(public.is_scavland_owner(),false) then raise sqlstate '42501' using message='Owner publication permission required.';end if;
 select * into current_row from scavland_pages.versions where page_id=preview_row.page_id order by version desc limit 1;
 if current_row.version is distinct from preview_row.version or current_row.archived then raise sqlstate 'PT409' using message='Saved page changed since preview.';end if;
 if exists(select 1 from scavland_pages.publications where page_id=preview_row.page_id and state not in ('live','refused')) then raise sqlstate 'PT409' using message='Page publication still requires reconciliation.';end if;
 insert into scavland_pages.publications(request_id,actor,page_id,preview_id) values(p_request,actor,preview_row.page_id,p_preview) returning * into receipt;
 return to_jsonb(receipt);
end;$$;
revoke all on function scavland_pages.reserve_publication(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.reserve_publication(uuid,uuid) to authenticated;
create function public.scavland_reserve_page_publication(p_request uuid,p_preview uuid)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.reserve_publication(p_request,p_preview);$$;
revoke all on function public.scavland_reserve_page_publication(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.scavland_reserve_page_publication(uuid,uuid) to authenticated;

create function scavland_pages.guard_pending_publication()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 if exists(select 1 from scavland_pages.publications where page_id=new.page_id and state not in ('live','refused')) then
  raise sqlstate 'PT409' using message='Page publication is pending. Keep your edits.';end if;
 return new;
end;$$;
revoke all on function scavland_pages.guard_pending_publication() from public,anon,authenticated,service_role;
create trigger page_pending_publication before insert on scavland_pages.versions for each row execute function scavland_pages.guard_pending_publication();

-- Only trusted Git/Pages reconciliation may supply outcomes. Browser events are forbidden.
create function scavland_pages.publication_outcome(p_request uuid,p_event_id uuid,p_event jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_pages.publications;prior scavland_pages.publication_events;result jsonb;kind text;
begin
 if p_request is null or p_event_id is null or p_event is null or jsonb_typeof(p_event)<>'object'
 or octet_length(p_event::text)>2048 then raise sqlstate '22023' using message='Invalid publication evidence.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-publication-event:'||p_event_id::text,0));
 select * into prior from scavland_pages.publication_events where event_id=p_event_id;
 if found then
  if prior.request_id<>p_request or prior.event<>p_event then raise sqlstate 'PT409' using message='Publication event reused.';end if;
  return prior.outcome;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-publish-request:'||p_request::text,0));
 select * into receipt from scavland_pages.publications where request_id=p_request;
 if not found then raise sqlstate '22023' using message='Publication intent required.';end if;
 if receipt.state='refused' then raise sqlstate 'PT409' using message='Refused publication is terminal.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 kind:=p_event->>'type';
 if kind='commit' then
  if (select count(*) from jsonb_object_keys(p_event))<>2 or jsonb_typeof(p_event->'sha') is distinct from 'string'
  or coalesce(p_event->>'sha','') !~ '^[a-f0-9]{40}$' then raise sqlstate '22023' using message='Invalid commit evidence.';end if;
  if receipt.commit_sha is not null and receipt.commit_sha<>p_event->>'sha' then raise sqlstate 'PT409' using message='Publication already has another commit.';end if;
  if receipt.state='prepared' then receipt.commit_sha:=p_event->>'sha';receipt.state:='committed';end if;
 elsif kind='build' then
  if (select count(*) from jsonb_object_keys(p_event))<>4 or receipt.state='prepared'
  or p_event->>'sha' is distinct from receipt.commit_sha or jsonb_typeof(p_event->'runId') is distinct from 'string'
  or coalesce(p_event->>'runId','') !~ '^[0-9]+$' or p_event->>'status' is null or p_event->>'status' not in ('success','failure','pending') then raise sqlstate 'PT409' using message='Build does not match publication.';end if;
  if receipt.state='live' and (p_event->>'status'<>'success' or p_event->>'runId'<>receipt.build_run) then raise sqlstate 'PT409' using message='Live receipt cannot change.';end if;
  if p_event->>'status'<>'pending' then receipt.build_run:=p_event->>'runId';receipt.state:=case p_event->>'status' when 'success' then 'live' else 'build-failed' end;end if;
 else raise sqlstate '22023' using message='Invalid publication event.';end if;
 update scavland_pages.publications set state=receipt.state,commit_sha=receipt.commit_sha,build_run=receipt.build_run,updated_at=clock_timestamp() where request_id=p_request returning * into receipt;
 result:=to_jsonb(receipt);
 insert into scavland_pages.publication_events(event_id,request_id,event,outcome) values(p_event_id,p_request,p_event,result);
 return result;
end;$$;
revoke all on function scavland_pages.publication_outcome(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.publication_outcome(uuid,uuid,jsonb) to service_role;
create function public.scavland_page_publication_outcome(p_request uuid,p_event_id uuid,p_event jsonb)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.publication_outcome(p_request,p_event_id,p_event);$$;
revoke all on function public.scavland_page_publication_outcome(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.scavland_page_publication_outcome(uuid,uuid,jsonb) to service_role;
commit;
