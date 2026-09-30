-- Apply only after shared-item-drafts.sql and coordinated release approval.
begin;
create table scavland_item_drafts.previews (
 id uuid primary key default gen_random_uuid(),actor uuid not null,item_id text not null,
 category text not null check(category in ('ammo','armour','weapons')),version integer not null,
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null default clock_timestamp()+interval '30 minutes'
);
alter table scavland_item_drafts.previews enable row level security;
revoke all on scavland_item_drafts.previews from public,anon,authenticated,service_role;
create function scavland_item_drafts.preview(p_actor uuid,p_item text,p_category text,p_version integer,
 p_digest text default null,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare head integer; result scavland_item_drafts.previews;
begin
 if p_actor is null or p_item is null or p_category is null or p_category not in ('ammo','armour','weapons')
 or p_version is null or p_version<1 then raise sqlstate '22023' using message='Invalid item preview.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-item:'||p_item,0));
 select coalesce(max(version),0) into head from scavland_item_drafts.versions where item_id=p_item;
 if head<>p_version then raise sqlstate 'PT409' using message='A newer item draft exists.';end if;
 if p_id is not null then
  select * into result from scavland_item_drafts.previews where id=p_id and actor=p_actor and item_id=p_item
   and category=p_category and version=p_version and expires_at>clock_timestamp();
  return case when found then to_jsonb(result) else null end;
 end if;
 if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise sqlstate '22023' using message='Invalid item preview digest.';end if;
 insert into scavland_item_drafts.previews(actor,item_id,category,version,digest)
 values(p_actor,p_item,p_category,p_version,p_digest) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function scavland_item_drafts.preview(uuid,text,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function scavland_item_drafts.preview(uuid,text,text,integer,text,uuid) to service_role;
create function public.scavland_item_preview(p_actor uuid,p_item text,p_category text,p_version integer,
 p_digest text default null,p_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select scavland_item_drafts.preview(p_actor,p_item,p_category,p_version,p_digest,p_id);
$$;
revoke all on function public.scavland_item_preview(uuid,text,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.scavland_item_preview(uuid,text,text,integer,text,uuid) to service_role;

-- Private old-draft access is restricted to the trusted bridge. The browser receives
-- only the selected item or an overlap error, never another item's saved draft.
create function scavland_item_drafts.legacy()
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(v) from scavland_drafts.versions v where domain='items' and entity_id='catalogue' order by version desc limit 1;
$$;
revoke all on function scavland_item_drafts.legacy() from public,anon,authenticated;
grant execute on function scavland_item_drafts.legacy() to service_role;
create function public.scavland_item_legacy()
returns jsonb language sql security invoker set search_path='' as $$select scavland_item_drafts.legacy();$$;
revoke all on function public.scavland_item_legacy() from public,anon,authenticated;
grant execute on function public.scavland_item_legacy() to service_role;
commit;
