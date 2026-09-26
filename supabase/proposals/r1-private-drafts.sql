-- R1 deployment proposal ONLY. No production migration has been applied.
-- Materialize using `supabase migration new private_admin_drafts` after approval.
-- Existing tables, functions, policies and public canonical files are not modified.
begin;
create schema scavland_drafts;
revoke all on schema scavland_drafts from public, anon, authenticated;
create table scavland_drafts.versions (
 domain text not null,
 entity_id text not null,
 version integer not null check(version > 0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 base jsonb not null check(jsonb_typeof(base)='object'),
 request_id uuid not null unique,
 saved_by uuid not null,
 saved_at timestamptz not null default clock_timestamp(),
 primary key(domain,entity_id,version)
);
alter table scavland_drafts.versions enable row level security;
revoke all on scavland_drafts.versions from public, anon, authenticated;
-- Immutable revisions also serve as durable idempotency receipts. No delete API.
-- Definer is confined to a non-exposed schema. Every call checks current DB permissions.
create function scavland_drafts.access(p_action text,p_domain text,p_entity_id text,
 p_expected_version integer default null,p_payload jsonb default null,
 p_base jsonb default null,p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); permission text; current_row scavland_drafts.versions;
 receipt scavland_drafts.versions; head integer:=0;
begin
 permission:=case p_domain when 'items' then 'items_edit' when 'ammo' then 'ammunition_edit'
 when 'vendors' then 'vendors_edit' when 'vendor-inventory' then 'vendors_edit' when 'pages' then 'content_edit' end;
 if actor is null or permission is null or not coalesce(public.has_scavland_permission(permission),false) then
  raise sqlstate '42501' using message='Authorized Admin permission is required.';
 end if;
 if p_entity_id is null or length(p_entity_id) not between 1 and 200 or p_entity_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
 or p_action is null or p_action not in ('load','save') then raise sqlstate '22023' using message='Invalid draft request.';end if;
 -- Same draft serializes even during first creation; collisions only cause extra waiting.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_domain||':'||p_entity_id,0));
 select * into current_row from scavland_drafts.versions where domain=p_domain and entity_id=p_entity_id order by version desc limit 1;
 head:=coalesce(current_row.version,0);
 if p_action='load' then return jsonb_build_object('draft',case when head=0 then null else to_jsonb(current_row) end,'currentVersion',head);end if;
 if p_expected_version is null or p_expected_version<0 or p_request_id is null
 or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576
 or p_base is null or jsonb_typeof(p_base)<>'object' or octet_length(p_base::text)>16384 then
  raise sqlstate '22023' using message='Invalid draft payload or version.';
 end if;
 if p_payload ? 'id' and (jsonb_typeof(p_payload->'id')<>'string' or p_payload->>'id'<>p_entity_id) then raise sqlstate '22023' using message='Draft identity cannot change.';end if;
 if exists(select 1 from jsonb_each(p_base) e where e.key !~ '^[A-Za-z0-9][A-Za-z0-9_./-]*$'
 or e.key like '%..%' or (e.value<>'null'::jsonb and (jsonb_typeof(e.value)<>'string' or (e.value#>>'{}') !~ '^[a-f0-9]{40}$'))) then
  raise sqlstate '22023' using message='Invalid public base revision.';
 end if;
 select * into receipt from scavland_drafts.versions where request_id=p_request_id;
 if found then
  if receipt.domain<>p_domain or receipt.entity_id<>p_entity_id or receipt.saved_by<>actor
  or receipt.version<>p_expected_version+1 or receipt.payload<>p_payload or receipt.base<>p_base then
   raise sqlstate 'PT409' using message='Save request was reused with different entries.';
  end if;
  return jsonb_build_object('draft',to_jsonb(receipt),'currentVersion',head,'replayed',true);
 end if;
 if head<>p_expected_version then raise sqlstate 'PT409' using message='Conflict — newer version exists. Keep your entries and reload explicitly.';end if;
 insert into scavland_drafts.versions(domain,entity_id,version,payload,base,request_id,saved_by)
 values(p_domain,p_entity_id,head+1,p_payload,p_base,p_request_id,actor) returning * into current_row;
 return jsonb_build_object('draft',to_jsonb(current_row),'currentVersion',head+1);
end;$$;
revoke all on function scavland_drafts.access(text,text,text,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
grant usage on schema scavland_drafts to authenticated;
grant execute on function scavland_drafts.access(text,text,text,integer,jsonb,jsonb,uuid) to authenticated;
-- Thin invoker RPC; expose only this function, never the private schema/table.
create function public.scavland_draft(p_action text,p_domain text,p_entity_id text,
 p_expected_version integer default null,p_payload jsonb default null,p_base jsonb default null,p_request_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select scavland_drafts.access(p_action,p_domain,p_entity_id,p_expected_version,p_payload,p_base,p_request_id);
$$;
revoke all on function public.scavland_draft(text,text,text,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.scavland_draft(text,text,text,integer,jsonb,jsonb,uuid) to authenticated;
commit;
