-- Apply only with coordinated Ammo release approval. Preserves existing Items/Vendor drafts.
begin;
do $$ begin
 if exists(select 1 from scavland_drafts.versions where domain='ammo') then
  raise exception 'Existing untrusted Ammo drafts require explicit review before activation.';
 end if;
end $$;
alter table scavland_drafts.prepared drop constraint prepared_domain_check;
alter table scavland_drafts.prepared add constraint prepared_domain_check check(domain in ('items','vendors','ammo'));
create or replace function scavland_drafts.prepare(p_actor uuid,p_domain text,p_version integer,
 p_request uuid,p_command jsonb,p_payload jsonb default null,p_base jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_drafts.prepared; head integer;
begin
 if p_actor is null or p_domain is null or p_domain not in ('items','vendors','ammo')
 or p_version is null or p_version<0 or p_request is null or p_command is null
 or jsonb_typeof(p_command)<>'object' or octet_length(p_command::text)>200000 then
  raise sqlstate '22023' using message='Invalid prepared action.';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_domain||':catalogue',0));
 select * into receipt from scavland_drafts.prepared where request_id=p_request;
 if found then
  if receipt.actor<>p_actor or receipt.domain<>p_domain or receipt.expected_version<>p_version or receipt.command<>p_command then
   raise sqlstate 'PT409' using message='Save request was reused with different entries.';
  end if;
  return to_jsonb(receipt);
 end if;
 if p_payload is null then return null;end if;
 select coalesce(max(version),0) into head from scavland_drafts.versions where domain=p_domain and entity_id='catalogue';
 if head<>p_version then raise sqlstate 'PT409' using message='Conflict — newer version exists.';end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1048576 or p_base is null
 or jsonb_typeof(p_base)<>'object' or octet_length(p_base::text)>16384 then
  raise sqlstate '22023' using message='Invalid prepared payload.';
 end if;
 insert into scavland_drafts.prepared(request_id,actor,domain,expected_version,command,payload,base)
 values(p_request,p_actor,p_domain,p_version,p_command,p_payload,p_base) returning * into receipt;
 return to_jsonb(receipt);
end $$;
create or replace function scavland_drafts.require_prepared() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.domain in ('items','vendors','ammo') then
  if new.entity_id<>'catalogue' or not exists(
   select 1 from scavland_drafts.prepared p where p.request_id=new.request_id
   and p.actor=new.saved_by and p.domain=new.domain and p.expected_version=new.version-1
   and p.payload=new.payload and p.base=new.base
  ) then raise sqlstate '42501' using message='Use an authenticated editor action. Unapproved snapshots cannot be saved.';end if;
 end if;
 return new;
end $$;
commit;
