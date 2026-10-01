-- Preparation proposal only. Requires existing shared and legacy draft schemas.
begin;
create table scavland_item_drafts.attachment_prepared (
 request_id uuid primary key,actor uuid not null,item_id text not null,
 command jsonb not null,payload jsonb not null,legacy_version integer not null,
 prepared_at timestamptz not null default clock_timestamp()
);
create table scavland_item_drafts.attachment_versions (
 item_id text not null,version integer not null check(version>0),payload jsonb not null,
 request_id uuid not null unique references scavland_item_drafts.attachment_prepared(request_id),
 saved_by uuid not null,saved_at timestamptz not null default clock_timestamp(),primary key(item_id,version)
);
alter table scavland_item_drafts.attachment_prepared enable row level security;
alter table scavland_item_drafts.attachment_versions enable row level security;
revoke all on scavland_item_drafts.attachment_prepared,scavland_item_drafts.attachment_versions from public,anon,authenticated,service_role;
create function scavland_item_drafts.prepare_attachment(p_actor uuid,p_item text,p_request uuid,p_command jsonb,p_payload jsonb,p_legacy integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_item_drafts.attachment_prepared;head integer;
begin
 if p_actor is null or p_item is null or length(p_item) not between 1 and 160 or p_request is null
 or p_legacy is null or p_legacy<0 or jsonb_typeof(p_command) is distinct from 'object'
 or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>1048576
 or p_payload->>'itemId' is distinct from p_item or p_payload->>'actor' is distinct from p_actor::text
 or p_payload->>'category' is distinct from 'attachments' or coalesce(p_payload->>'expectedVersion','') !~ '^(0|[1-9][0-9]{0,8})$'
 or p_payload->'record'->>'id' is distinct from p_item or p_payload->'record'->>'contentType' is distinct from 'Attachment' then
 raise sqlstate '22023' using message='Invalid Attachment preparation.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('item-request:'||p_request::text,0));
 select * into receipt from scavland_item_drafts.attachment_prepared where request_id=p_request;
 if found then
 if receipt.actor<>p_actor or receipt.item_id<>p_item or receipt.command<>p_command or receipt.payload<>p_payload or receipt.legacy_version<>p_legacy then
 raise sqlstate 'PT409' using message='Preparation request changed.';end if;
 return to_jsonb(receipt);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('items:catalogue',0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-item:'||p_item,0));
 select coalesce(max(version),0) into head from scavland_drafts.versions where domain='items' and entity_id='catalogue';
 if head<>p_legacy or exists(select 1 from scavland_item_drafts.versions where item_id=p_item)
 or (select coalesce(max(version),0) from scavland_item_drafts.attachment_versions where item_id=p_item)<>(p_payload->>'expectedVersion')::integer then
 raise sqlstate 'PT409' using message='Private work changed. Review again.';end if;
 insert into scavland_item_drafts.attachment_prepared(request_id,actor,item_id,command,payload,legacy_version)
 values(p_request,p_actor,p_item,p_command,p_payload,p_legacy) returning * into receipt;
 return to_jsonb(receipt);
end $$;
create function scavland_item_drafts.attachment_access(p_action text,p_item text,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();receipt scavland_item_drafts.attachment_prepared;saved scavland_item_drafts.attachment_versions;head integer;
begin
 if actor is null or not coalesce(public.has_scavland_permission('items_edit'),false) then
 raise sqlstate '42501' using message='Items editing permission is required.';end if;
 if p_item is null or length(p_item) not between 1 and 160 or p_action is null or p_action not in ('load','save') then
 raise sqlstate '22023' using message='Invalid Attachment request.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('items:catalogue',0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-item:'||p_item,0));
 select * into saved from scavland_item_drafts.attachment_versions where item_id=p_item order by version desc limit 1;
 if p_action='load' then return jsonb_build_object('currentVersion',coalesce(saved.version,0),'draft',case when saved.item_id is not null then to_jsonb(saved) else null end);end if;
 select * into receipt from scavland_item_drafts.attachment_prepared where request_id=p_request;
 if not found or receipt.actor<>actor or receipt.item_id<>p_item then raise sqlstate '42501' using message='Authenticated preparation required.';end if;
 if exists(select 1 from scavland_item_drafts.attachment_versions where request_id=p_request) then return (select to_jsonb(v) from scavland_item_drafts.attachment_versions v where request_id=p_request);end if;
 select coalesce(max(version),0) into head from scavland_drafts.versions where domain='items' and entity_id='catalogue';
 if head<>receipt.legacy_version or coalesce(saved.version,0)<>(receipt.payload->>'expectedVersion')::integer or exists(select 1 from scavland_item_drafts.versions where item_id=p_item)
 then raise sqlstate 'PT409' using message='Private work changed. Review again.';end if;
 insert into scavland_item_drafts.attachment_versions values(p_item,coalesce(saved.version,0)+1,receipt.payload,p_request,actor,clock_timestamp()) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function scavland_item_drafts.prepare_attachment(uuid,text,uuid,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function scavland_item_drafts.prepare_attachment(uuid,text,uuid,jsonb,jsonb,integer) to service_role;
revoke all on function scavland_item_drafts.attachment_access(text,text,uuid) from public,anon;
grant execute on function scavland_item_drafts.attachment_access(text,text,uuid) to authenticated;
-- Both stores use one item lock even for inserts through future service adapters.
create function scavland_item_drafts.guard_attachment_overlap()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-item:'||new.item_id,0));
 if tg_table_name='versions' then
  if exists(select 1 from scavland_item_drafts.attachment_versions where item_id=new.item_id) then
   raise sqlstate 'PT409' using message='An Attachment draft already exists. Review it before saving specialist work.';
  end if;
 else
  if exists(select 1 from scavland_item_drafts.versions where item_id=new.item_id) then
   raise sqlstate 'PT409' using message='A specialist draft already exists. Review it before saving Attachment work.';
  end if;
 end if;
 return new;
end $$;
revoke all on function scavland_item_drafts.guard_attachment_overlap() from public,anon,authenticated,service_role;
create trigger shared_item_attachment_overlap before insert on scavland_item_drafts.versions
 for each row execute function scavland_item_drafts.guard_attachment_overlap();
create trigger attachment_shared_item_overlap before insert on scavland_item_drafts.attachment_versions
 for each row execute function scavland_item_drafts.guard_attachment_overlap();
create function public.scavland_attachment_receipt(p_actor uuid,p_item text,p_request uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_item_drafts.attachment_prepared;
begin
 if p_actor is null or p_item is null or p_request is null or jsonb_typeof(p_command) is distinct from 'object' then raise sqlstate '22023' using message='Invalid preparation lookup.';end if;
 select * into receipt from scavland_item_drafts.attachment_prepared where request_id=p_request;
 if not found then return null;end if;
 if receipt.actor<>p_actor or receipt.item_id<>p_item or receipt.command<>p_command then raise sqlstate 'PT409' using message='Request reused with different entries.';end if;
 return to_jsonb(receipt);
end $$;
revoke all on function public.scavland_attachment_receipt(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.scavland_attachment_receipt(uuid,text,uuid,jsonb) to service_role;
create function public.scavland_prepare_attachment(p_actor uuid,p_item text,p_request uuid,p_command jsonb,p_payload jsonb,p_legacy integer)
returns jsonb language sql security invoker set search_path='' as $$select scavland_item_drafts.prepare_attachment(p_actor,p_item,p_request,p_command,p_payload,p_legacy);$$;
revoke all on function public.scavland_prepare_attachment(uuid,text,uuid,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.scavland_prepare_attachment(uuid,text,uuid,jsonb,jsonb,integer) to service_role;
create function public.scavland_attachment_draft(p_action text,p_item text,p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select scavland_item_drafts.attachment_access(p_action,p_item,p_request);$$;
revoke all on function public.scavland_attachment_draft(text,text,uuid) from public,anon;
grant execute on function public.scavland_attachment_draft(text,text,uuid) to authenticated;
commit;
