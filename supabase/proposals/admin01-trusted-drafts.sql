-- Apply AFTER r1-private-drafts.sql, only after deployment approval.
-- Trusted preparations close the direct-RPC snapshot/verification injection path.
begin;
do $$ begin
 if exists(select 1 from scavland_drafts.versions where domain in ('items','vendors')) then
  raise exception 'Untrusted existing core drafts require explicit review before this migration.';
 end if;
end $$;
create table scavland_drafts.prepared (
 request_id uuid primary key,
 actor uuid not null,
 domain text not null check(domain in ('items','vendors')),
 expected_version integer not null check(expected_version>=0),
 command jsonb not null check(jsonb_typeof(command)='object'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 base jsonb not null check(jsonb_typeof(base)='object'),
 prepared_at timestamptz not null default clock_timestamp()
);
alter table scavland_drafts.prepared enable row level security;
revoke all on scavland_drafts.prepared from public,anon,authenticated,service_role;

-- The Edge Function supplies actor only after Auth /user and caller-JWT permission checks.
-- A null payload is a receipt lookup; retries recover original generated IDs/times.
create function scavland_drafts.prepare(p_actor uuid,p_domain text,p_version integer,
 p_request uuid,p_command jsonb,p_payload jsonb default null,p_base jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_drafts.prepared; head integer;
begin
 if p_actor is null or p_domain is null or p_domain not in ('items','vendors')
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
revoke all on function scavland_drafts.prepare(uuid,text,integer,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant usage on schema scavland_drafts to service_role;
grant execute on function scavland_drafts.prepare(uuid,text,integer,uuid,jsonb,jsonb,jsonb) to service_role;
create function public.scavland_prepare(p_actor uuid,p_domain text,p_version integer,
 p_request uuid,p_command jsonb,p_payload jsonb default null,p_base jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select scavland_drafts.prepare(p_actor,p_domain,p_version,p_request,p_command,p_payload,p_base);
$$;
revoke all on function public.scavland_prepare(uuid,text,integer,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.scavland_prepare(uuid,text,integer,uuid,jsonb,jsonb,jsonb) to service_role;

create function scavland_drafts.require_prepared() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.domain in ('items','vendors') then
  if new.entity_id<>'catalogue' or not exists(
   select 1 from scavland_drafts.prepared p where p.request_id=new.request_id
   and p.actor=new.saved_by and p.domain=new.domain and p.expected_version=new.version-1
   and p.payload=new.payload and p.base=new.base
  ) then raise sqlstate '42501' using message='Use an authenticated editor action. Unapproved snapshots cannot be saved.';end if;
 end if;
 return new;
end $$;
revoke all on function scavland_drafts.require_prepared() from public,anon,authenticated,service_role;
create trigger require_prepared before insert on scavland_drafts.versions
for each row execute function scavland_drafts.require_prepared();

-- Private record of owner-authorized patch attempts. Git remains the authoritative
-- current patch; failed/uncertain Git publication must not advance public patch state.
create table scavland_drafts.patch_attempts (
 id bigint generated always as identity primary key,
 actor uuid not null, base_sha text not null, settings jsonb not null,
 recorded_at timestamptz not null default clock_timestamp()
);
alter table scavland_drafts.patch_attempts enable row level security;
revoke all on scavland_drafts.patch_attempts from public,anon,authenticated,service_role;
create function scavland_drafts.record_patch(p_actor uuid,p_base text,p_settings jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_actor is null or p_base is null or length(p_base)>100 or p_settings is null
 or jsonb_typeof(p_settings)<>'object' or octet_length(p_settings::text)>1048576 then
  raise sqlstate '22023' using message='Invalid private patch audit.';
 end if;
 insert into scavland_drafts.patch_attempts(actor,base_sha,settings) values(p_actor,p_base,p_settings);
 return true;
end $$;
revoke all on function scavland_drafts.record_patch(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function scavland_drafts.record_patch(uuid,text,jsonb) to service_role;
create function public.scavland_patch_audit(p_actor uuid,p_base text,p_settings jsonb)
returns boolean language sql security invoker set search_path='' as $$
 select scavland_drafts.record_patch(p_actor,p_base,p_settings);
$$;
revoke all on function public.scavland_patch_audit(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.scavland_patch_audit(uuid,text,jsonb) to service_role;
create function scavland_drafts.patch_history(p_patch text)
returns jsonb language sql stable security definer set search_path='' as $$
 select settings from scavland_drafts.patch_attempts
 where settings->>'current_patch_id'=p_patch order by id desc limit 1;
$$;
revoke all on function scavland_drafts.patch_history(text) from public,anon,authenticated;
grant execute on function scavland_drafts.patch_history(text) to service_role;
create function public.scavland_patch_history(p_patch text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select scavland_drafts.patch_history(p_patch);
$$;
revoke all on function public.scavland_patch_history(text) from public,anon,authenticated;
grant execute on function public.scavland_patch_history(text) to service_role;
commit;
