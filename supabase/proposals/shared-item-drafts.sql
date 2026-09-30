-- Preparation only: apply after reviewed coordinated rollout. Existing draft schemas untouched.
begin;
create schema scavland_item_drafts;
revoke all on schema scavland_item_drafts from public,anon,authenticated;
create table scavland_item_drafts.prepared (
 request_id uuid primary key, actor uuid not null, item_id text not null,
 category text not null check(category in ('ammo','armour','weapons')),
 expected_version integer not null check(expected_version>=0),
 command jsonb not null check(jsonb_typeof(command)='object'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 prepared_at timestamptz not null default clock_timestamp()
);
create table scavland_item_drafts.versions (
 item_id text not null, version integer not null check(version>0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 request_id uuid not null unique references scavland_item_drafts.prepared(request_id),
 saved_by uuid not null, saved_at timestamptz not null default clock_timestamp(),
 primary key(item_id,version)
);
alter table scavland_item_drafts.prepared enable row level security;
alter table scavland_item_drafts.versions enable row level security;
revoke all on scavland_item_drafts.prepared,scavland_item_drafts.versions from public,anon,authenticated,service_role;

-- Only the trusted service can prepare, after caller Auth, category membership,
-- permission, legacy-draft overlap and source checks. Lookup recovers original IDs/times.
create function scavland_item_drafts.prepare(p_actor uuid,p_item text,p_category text,p_version integer,
 p_request uuid,p_command jsonb,p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_item_drafts.prepared; head integer;
begin
 if p_actor is null or (p_item is not null and length(p_item) not between 1 and 160)
 or p_category is null or p_category not in ('ammo','armour','weapons')
 or p_version is null or p_version<0 or p_request is null or p_command is null
 or jsonb_typeof(p_command)<>'object' or octet_length(p_command::text)>200000 then
  raise sqlstate '22023' using message='Invalid item preparation.';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('item-request:'||p_request::text,0));
 select * into receipt from scavland_item_drafts.prepared where request_id=p_request;
 if found then
  if receipt.actor<>p_actor or (p_item is not null and receipt.item_id<>p_item) or receipt.category<>p_category
  or receipt.expected_version<>p_version or receipt.command<>p_command then
   raise sqlstate 'PT409' using message='Request reused with different item entries.';
  end if;
  return to_jsonb(receipt);
 end if;
 if p_payload is null then return null;end if;
 if p_item is null then raise sqlstate '22023' using message='Server identity required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-item:'||p_item,0));
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576
 or p_payload->>'itemId' is distinct from p_item or p_payload->>'category' is distinct from p_category then
  raise sqlstate '22023' using message='Invalid prepared item payload.';
 end if;
 select coalesce(max(version),0) into head from scavland_item_drafts.versions where item_id=p_item;
 if head<>p_version then raise sqlstate 'PT409' using message='A newer item draft exists.';end if;
 insert into scavland_item_drafts.prepared(request_id,actor,item_id,category,expected_version,command,payload)
 values(p_request,p_actor,p_item,p_category,p_version,p_command,p_payload) returning * into receipt;
 return to_jsonb(receipt);
end $$;
revoke all on function scavland_item_drafts.prepare(uuid,text,text,integer,uuid,jsonb,jsonb) from public,anon,authenticated;
grant usage on schema scavland_item_drafts to service_role;
grant execute on function scavland_item_drafts.prepare(uuid,text,text,integer,uuid,jsonb,jsonb) to service_role;
create function public.scavland_prepare_item(p_actor uuid,p_item text,p_category text,p_version integer,
 p_request uuid,p_command jsonb,p_payload jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select scavland_item_drafts.prepare(p_actor,p_item,p_category,p_version,p_request,p_command,p_payload);
$$;
revoke all on function public.scavland_prepare_item(uuid,text,text,integer,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.scavland_prepare_item(uuid,text,text,integer,uuid,jsonb,jsonb) to service_role;

-- Browser save contains a receipt ID, never a browser-controlled payload or actor.
create function scavland_item_drafts.access(p_action text,p_item text,p_category text,
 p_expected_version integer default null,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); permission text; head integer:=0;
 current_row scavland_item_drafts.versions; receipt scavland_item_drafts.prepared;
 prior scavland_item_drafts.versions;
begin
 permission:=case p_category when 'ammo' then 'ammunition_edit' when 'armour' then 'armour_edit' when 'weapons' then 'weapons_edit' end;
 if actor is null or permission is null or not coalesce(public.has_scavland_permission(permission),false) then
  raise sqlstate '42501' using message='Category permission is required.';
 end if;
 if p_action='list' then return coalesce((select jsonb_agg(jsonb_build_object('itemId',v.item_id,'payload',v.payload)) from
  (select distinct on (item_id) item_id,payload from scavland_item_drafts.versions order by item_id,version desc) v
  where (v.payload->'original' ? p_category) or coalesce(v.payload->'original'->'items'->'classification' ?
   (case p_category when 'ammo' then 'ammunition' when 'armour' then 'armour' when 'weapons' then 'weapon' end),false)), '[]'::jsonb);end if;
 if p_item is null or length(p_item) not between 1 and 160 or p_action is null or p_action not in ('load','save') then
  raise sqlstate '22023' using message='Invalid item draft request.';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-item:'||p_item,0));
 select * into current_row from scavland_item_drafts.versions where item_id=p_item order by version desc limit 1;
 head:=coalesce(current_row.version,0);
 -- A saved draft is visible only through one of its server-proven categories.
 if head>0 and not (current_row.payload->'original' ? p_category) and not
  coalesce(current_row.payload->'original'->'items'->'classification' ?
   (case p_category when 'ammo' then 'ammunition' when 'armour' then 'armour' when 'weapons' then 'weapon' end),false) then
  raise sqlstate '42501' using message='This item is outside the permitted category.';
 end if;
 if p_action='load' then return jsonb_build_object('currentVersion',head,'draft',case when head>0 then to_jsonb(current_row) else null end);end if;
 if p_expected_version is null or p_expected_version<0 or p_request is null then
  raise sqlstate '22023' using message='Version and prepared receipt are required.';
 end if;
 select * into receipt from scavland_item_drafts.prepared where request_id=p_request;
 if not found or receipt.actor<>actor or receipt.item_id<>p_item or receipt.category<>p_category
 or receipt.expected_version<>p_expected_version then
  raise sqlstate '42501' using message='An authenticated prepared action is required.';
 end if;
 select * into prior from scavland_item_drafts.versions where request_id=p_request;
 if found then return jsonb_build_object('currentVersion',head,'draft',to_jsonb(prior));end if;
 if head<>p_expected_version then raise sqlstate 'PT409' using message='A newer item draft exists.';end if;
 insert into scavland_item_drafts.versions(item_id,version,payload,request_id,saved_by)
 values(p_item,head+1,receipt.payload,p_request,actor) returning * into current_row;
 return jsonb_build_object('currentVersion',head+1,'draft',to_jsonb(current_row));
end $$;
revoke all on function scavland_item_drafts.access(text,text,text,integer,uuid) from public,anon;
grant usage on schema scavland_item_drafts to authenticated;
grant execute on function scavland_item_drafts.access(text,text,text,integer,uuid) to authenticated;
create function public.scavland_item_draft(p_action text,p_item text,p_category text,
 p_expected_version integer default null,p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select scavland_item_drafts.access(p_action,p_item,p_category,p_expected_version,p_request);
$$;
revoke all on function public.scavland_item_draft(text,text,text,integer,uuid) from public,anon;
grant execute on function public.scavland_item_draft(text,text,text,integer,uuid) to authenticated;
commit;
