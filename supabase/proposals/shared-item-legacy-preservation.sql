-- Proposal only. Apply after shared-item-drafts.sql and shared-item-api.sql.
-- Snapshot existing trusted rows; never take an archive payload from a browser.
begin;
create table scavland_item_drafts.legacy_snapshots (
 domain text not null check(domain='items'),entity_id text not null check(entity_id='catalogue'),
 version integer not null check(version>0),snapshot jsonb not null,
 preserved_at timestamptz not null default clock_timestamp(),
 primary key(domain,entity_id,version)
);
alter table scavland_item_drafts.legacy_snapshots enable row level security;
revoke all on scavland_item_drafts.legacy_snapshots from public,anon,authenticated,service_role;
create function scavland_item_drafts.preserve_legacy(p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source jsonb;existing scavland_item_drafts.legacy_snapshots;head integer;
begin
 if p_version is null or p_version<1 then raise sqlstate '22023' using message='A reviewed legacy version is required.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('legacy-preserve:items',0));
 select max(version) into head from scavland_drafts.versions where domain='items' and entity_id='catalogue';
 if head is distinct from p_version then raise sqlstate 'PT409' using message='Legacy draft changed. Review its current version before preservation.';end if;
 select to_jsonb(v) into source from scavland_drafts.versions v where domain='items' and entity_id='catalogue' and version=p_version;
 select * into existing from scavland_item_drafts.legacy_snapshots where domain='items' and entity_id='catalogue' and version=p_version;
 if found then
  if existing.snapshot<>source then raise sqlstate 'PT409' using message='Legacy source differs from its preserved snapshot.';end if;
  return to_jsonb(existing);
 end if;
 insert into scavland_item_drafts.legacy_snapshots(domain,entity_id,version,snapshot)
 values('items','catalogue',p_version,source) returning * into existing;
 return to_jsonb(existing);
end $$;
revoke all on function scavland_item_drafts.preserve_legacy(integer) from public,anon,authenticated;
grant execute on function scavland_item_drafts.preserve_legacy(integer) to service_role;
create function public.scavland_preserve_item_legacy(p_version integer)
returns jsonb language sql security invoker set search_path='' as $$select scavland_item_drafts.preserve_legacy(p_version);$$;
revoke all on function public.scavland_preserve_item_legacy(integer) from public,anon,authenticated;
grant execute on function public.scavland_preserve_item_legacy(integer) to service_role;
commit;
