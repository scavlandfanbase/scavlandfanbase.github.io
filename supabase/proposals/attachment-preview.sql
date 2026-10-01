-- Preparation only; requires attachment-classification-storage.sql.
begin;
create table scavland_item_drafts.attachment_previews (
 id uuid primary key default gen_random_uuid(),actor uuid not null,item_id text not null,
 version integer not null check(version>0),digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null default clock_timestamp()+interval '30 minutes'
);
alter table scavland_item_drafts.attachment_previews enable row level security;
revoke all on scavland_item_drafts.attachment_previews from public,anon,authenticated,service_role;
create function public.scavland_attachment_preview(p_actor uuid,p_item text,p_version integer,p_digest text default null,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare head integer;preview scavland_item_drafts.attachment_previews;
begin
 if p_actor is null or p_item is null or length(p_item) not between 1 and 160 or p_version is null or p_version<1 then
 raise sqlstate '22023' using message='Invalid Attachment preview.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shared-item:'||p_item,0));
 select coalesce(max(version),0) into head from scavland_item_drafts.attachment_versions where item_id=p_item;
 if head<>p_version then raise sqlstate 'PT409' using message='A newer Attachment draft exists.';end if;
 if p_id is not null then
 select * into preview from scavland_item_drafts.attachment_previews where id=p_id and actor=p_actor and item_id=p_item and version=p_version and expires_at>clock_timestamp();
 return case when found then to_jsonb(preview) else null end;
 end if;
 if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise sqlstate '22023' using message='Invalid preview digest.';end if;
 insert into scavland_item_drafts.attachment_previews(actor,item_id,version,digest) values(p_actor,p_item,p_version,p_digest) returning * into preview;
 return to_jsonb(preview);
end $$;
revoke all on function public.scavland_attachment_preview(uuid,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.scavland_attachment_preview(uuid,text,integer,text,uuid) to service_role;
commit;
