-- Unapplied preparation proposal. No production route uses these functions.
-- Trusted service prepares only after caller Auth, content_edit and model checks.
begin;
create schema scavland_pages;
revoke all on schema scavland_pages from public,anon,authenticated,service_role;
create table scavland_pages.requests (
 request_id uuid primary key,actor uuid not null,action text not null check(action in ('create','save','archive')),
 page_id uuid not null,expected_version integer not null check(expected_version>=0),
 command jsonb not null check(jsonb_typeof(command)='object'),
 payload jsonb check(payload is null or jsonb_typeof(payload)='object'),
 prepared_at timestamptz not null default clock_timestamp()
);
create table scavland_pages.versions (
 page_id uuid not null,version integer not null check(version>0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),archived boolean not null,
 request_id uuid not null unique references scavland_pages.requests(request_id),
 saved_by uuid not null,saved_at timestamptz not null default clock_timestamp(),
 primary key(page_id,version)
);
-- Private addresses remain reserved after rename/archive; publication must also
-- check protected and existing public routes against trusted repository state.
create table scavland_pages.addresses (slug text primary key,page_id uuid not null);
alter table scavland_pages.requests enable row level security;
alter table scavland_pages.versions enable row level security;
alter table scavland_pages.addresses enable row level security;
revoke all on scavland_pages.requests,scavland_pages.versions,scavland_pages.addresses from public,anon,authenticated,service_role;

create function scavland_pages.prepare(p_actor uuid,p_request uuid,p_action text,p_page uuid,
 p_version integer,p_command jsonb,p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_pages.requests; current_row scavland_pages.versions; assigned uuid;
begin
 if p_actor is null or p_request is null or p_action is null or p_action not in ('create','save','archive')
 or p_version is null or p_version<0 or p_version>=2147483647 or p_command is null or jsonb_typeof(p_command)<>'object'
 or octet_length(p_command::text)>1048576
 or (p_action='create' and (p_page is not null or p_version<>0))
 or (p_action<>'create' and (p_page is null or p_version<1)) then
  raise sqlstate '22023' using message='Invalid page preparation.';end if;
 -- Stable order: request, then catalogue write lock. All mutations use this order.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-request:'||p_request::text,0));
 select * into receipt from scavland_pages.requests where request_id=p_request;
 if found then
  if receipt.actor<>p_actor or receipt.action<>p_action or receipt.expected_version<>p_version
  or receipt.command<>p_command or (p_page is not null and receipt.page_id<>p_page) then
   raise sqlstate 'PT409' using message='Page request reused with different entries.';end if;
  if receipt.payload is not null then
   if p_payload is not null and receipt.payload<>p_payload then raise sqlstate 'PT409' using message='Prepared page cannot change.';end if;
   return to_jsonb(receipt);
  end if;
 else
  assigned:=case when p_action='create' then pg_catalog.gen_random_uuid() else p_page end;
  insert into scavland_pages.requests(request_id,actor,action,page_id,expected_version,command)
  values(p_request,p_actor,p_action,assigned,p_version,p_command) returning * into receipt;
 end if;
 -- Allocation-only lookup supports injecting permanent ID before model validation.
 if p_payload is null and p_action<>'archive' then return to_jsonb(receipt);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 select * into current_row from scavland_pages.versions where page_id=receipt.page_id order by version desc limit 1;
 if coalesce(current_row.version,0)<>p_version or coalesce(current_row.archived,false) then
  raise sqlstate 'PT409' using message='Page changed or is archived.';end if;
 if p_action='archive' then
  if p_payload is not null then raise sqlstate '22023' using message='Archive preserves saved content.';end if;
  p_payload:=current_row.payload;
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576
 or jsonb_typeof(p_payload->'id') is distinct from 'string'
 or jsonb_typeof(p_payload->'slug') is distinct from 'string'
 or p_payload->>'id' is distinct from receipt.page_id::text
 or coalesce(p_payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 or length(p_payload->>'slug')>80 then raise sqlstate '22023' using message='Invalid prepared page.';end if;
 update scavland_pages.requests set payload=p_payload where request_id=p_request returning * into receipt;
 return to_jsonb(receipt);
end;$$;
revoke all on function scavland_pages.prepare(uuid,uuid,text,uuid,integer,jsonb,jsonb) from public,anon,authenticated,service_role;
grant usage on schema scavland_pages to service_role,authenticated;
grant execute on function scavland_pages.prepare(uuid,uuid,text,uuid,integer,jsonb,jsonb) to service_role;
create function public.scavland_prepare_page(p_actor uuid,p_request uuid,p_action text,p_page uuid,
 p_version integer,p_command jsonb,p_payload jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select scavland_pages.prepare(p_actor,p_request,p_action,p_page,p_version,p_command,p_payload);
$$;
revoke all on function public.scavland_prepare_page(uuid,uuid,text,uuid,integer,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.scavland_prepare_page(uuid,uuid,text,uuid,integer,jsonb,jsonb) to service_role;

create function scavland_pages.access(p_action text,p_page uuid default null,p_request uuid default null,p_after uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();receipt scavland_pages.requests;current_row scavland_pages.versions;prior scavland_pages.versions;address_owner uuid;
begin
 if actor is null or not coalesce(public.has_scavland_permission('content_edit'),false) then
  raise sqlstate '42501' using message='Content editing permission required.';end if;
 if p_action is null or p_action not in ('list','load','commit') then raise sqlstate '22023' using message='Invalid page action.';end if;
 if p_action='list' then
  if p_page is not null or p_request is not null then raise sqlstate '22023' using message='Invalid page list.';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('pageId',v.page_id,'version',v.version,
   'title',v.payload->>'title','slug',v.payload->>'slug','archived',v.archived,'savedAt',v.saved_at) order by v.page_id)
   from (select distinct on (page_id) * from scavland_pages.versions where p_after is null or page_id>p_after order by page_id,version desc limit 100) v),'[]'::jsonb);
 end if;
 if p_page is null or p_after is not null then raise sqlstate '22023' using message='Page identity required.';end if;
 if p_action='load' then
  if p_request is not null then raise sqlstate '22023' using message='Invalid page load.';end if;
  select * into current_row from scavland_pages.versions where page_id=p_page order by version desc limit 1;
  return jsonb_build_object('draft',case when current_row.version is null then null else to_jsonb(current_row) end,
   'currentVersion',coalesce(current_row.version,0));
 end if;
 if p_request is null then raise sqlstate '22023' using message='Prepared receipt required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-request:'||p_request::text,0));
 select * into receipt from scavland_pages.requests where request_id=p_request;
 if not found or receipt.actor<>actor or receipt.page_id<>p_page or receipt.payload is null then
  raise sqlstate '42501' using message='Matching prepared page required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 select * into current_row from scavland_pages.versions where page_id=p_page order by version desc limit 1;
 select * into prior from scavland_pages.versions where request_id=p_request;
 if found then return jsonb_build_object('draft',to_jsonb(prior),'currentVersion',current_row.version,'replayed',true);end if;
 if coalesce(current_row.version,0)<>receipt.expected_version or coalesce(current_row.archived,false) then
  raise sqlstate 'PT409' using message='Page changed or is archived. Keep your entries.';end if;
 select page_id into address_owner from scavland_pages.addresses where slug=receipt.payload->>'slug';
 if found and address_owner<>p_page then raise sqlstate 'PT409' using message='Page address is reserved.';end if;
 insert into scavland_pages.addresses(slug,page_id) values(receipt.payload->>'slug',p_page) on conflict(slug) do nothing;
 insert into scavland_pages.versions(page_id,version,payload,archived,request_id,saved_by)
 values(p_page,receipt.expected_version+1,receipt.payload,receipt.action='archive',p_request,actor) returning * into current_row;
 return jsonb_build_object('draft',to_jsonb(current_row),'currentVersion',current_row.version,'replayed',false);
end;$$;
revoke all on function scavland_pages.access(text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.access(text,uuid,uuid,uuid) to authenticated;
create function public.scavland_page(p_action text,p_page uuid default null,p_request uuid default null,p_after uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.access(p_action,p_page,p_request,p_after);$$;
revoke all on function public.scavland_page(text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.scavland_page(text,uuid,uuid,uuid) to authenticated;
commit;
