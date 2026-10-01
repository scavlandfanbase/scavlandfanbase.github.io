-- Preparation only. Requires attachment-classification-storage.sql. Never allocates a public record.
begin;
create table scavland_item_drafts.attachment_allocations (
 request_id uuid primary key,actor uuid not null,command jsonb not null,
 item_id text not null unique default ('attachment-'||gen_random_uuid()::text),
 allocated_at timestamptz not null default clock_timestamp()
);
alter table scavland_item_drafts.attachment_allocations enable row level security;
revoke all on scavland_item_drafts.attachment_allocations from public,anon,authenticated,service_role;
create function public.scavland_allocate_attachment(p_actor uuid,p_request uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare allocation scavland_item_drafts.attachment_allocations;
begin
 if p_actor is null or p_request is null or jsonb_typeof(p_command) is distinct from 'object'
 or octet_length(p_command::text)>50000 or p_command->>'action' is distinct from 'create-attachment'
 or p_command->'confirmCreation' is distinct from 'true'::jsonb or jsonb_typeof(p_command->'fields') is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_command) k where k not in ('action','fields','confirmCreation')) then
 raise sqlstate '22023' using message='Invalid new Attachment allocation.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('item-request:'||p_request::text,0));
 select * into allocation from scavland_item_drafts.attachment_allocations where request_id=p_request;
 if found then
  if allocation.actor<>p_actor or allocation.command<>p_command then raise sqlstate 'PT409' using message='Creation request reused with different entries.';end if;
  return to_jsonb(allocation)||jsonb_build_object('privateItemIds',coalesce((select jsonb_agg(item_id) from (select item_id from scavland_item_drafts.versions union select item_id from scavland_item_drafts.attachment_versions) ids),'[]'::jsonb));
 end if;
 if exists(select 1 from scavland_item_drafts.attachment_prepared where request_id=p_request)
 or exists(select 1 from scavland_item_drafts.prepared where request_id=p_request) then raise sqlstate 'PT409' using message='Request already belongs to another action.';end if;
 insert into scavland_item_drafts.attachment_allocations(request_id,actor,command) values(p_request,p_actor,p_command) returning * into allocation;
 return to_jsonb(allocation)||jsonb_build_object('privateItemIds',coalesce((select jsonb_agg(item_id) from (select item_id from scavland_item_drafts.versions union select item_id from scavland_item_drafts.attachment_versions) ids),'[]'::jsonb));
end $$;
revoke all on function public.scavland_allocate_attachment(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.scavland_allocate_attachment(uuid,uuid,jsonb) to service_role;
create function scavland_item_drafts.guard_attachment_allocation()
returns trigger language plpgsql security definer set search_path='' as $$
declare allocation scavland_item_drafts.attachment_allocations;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('item-request:'||new.request_id::text,0));
 select * into allocation from scavland_item_drafts.attachment_allocations where request_id=new.request_id;
 if not found then return new;end if;
 if tg_table_name<>'attachment_prepared' then raise sqlstate 'PT409' using message='Request belongs to new Attachment creation.';end if;
 if new.actor<>allocation.actor or new.item_id<>allocation.item_id or new.command<>allocation.command
 or new.payload->'creation' is distinct from 'true'::jsonb or new.payload->'before' is distinct from 'null'::jsonb
 or new.payload->>'expectedVersion' is distinct from '0' then raise sqlstate 'PT409' using message='Prepared creation does not match its allocated identity.';end if;
 return new;
end $$;
revoke all on function scavland_item_drafts.guard_attachment_allocation() from public,anon,authenticated,service_role;
create trigger attachment_creation_receipt_binding before insert on scavland_item_drafts.attachment_prepared for each row execute function scavland_item_drafts.guard_attachment_allocation();
create trigger shared_creation_request_binding before insert on scavland_item_drafts.prepared for each row execute function scavland_item_drafts.guard_attachment_allocation();
commit;
