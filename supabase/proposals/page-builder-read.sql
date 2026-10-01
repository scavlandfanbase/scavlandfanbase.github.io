-- Unapplied private read surface, after dispatch storage.
begin;
create function scavland_pages.read_page_work(p_action text,p_page uuid,p_version integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=auth.uid();result jsonb;
begin
 if caller_id is null or not coalesce(public.has_scavland_permission('content_edit'),false) then raise sqlstate '42501' using message='Content permission required.';end if;
 if p_action='page-state' then
  if p_page is null or p_version is not null or p_request is not null then raise sqlstate '22023' using message='Invalid page status request.';end if;
  select jsonb_build_object('requestId',p.request_id,'state',p.state,'version',r.version,'own',p.actor=caller_id,'commit',p.commit_sha)
  into result from scavland_pages.publications p join scavland_pages.previews r on r.request_id=p.preview_id
  where p.page_id=p_page order by p.created_at desc limit 1;
  return result;
 elsif p_action='history' then
  if p_page is null or p_version is not null or p_request is not null then raise sqlstate '22023' using message='Invalid history request.';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('version',v.version,'savedAt',v.saved_at,'archived',v.archived) order by v.version desc)
   from (select version,saved_at,archived from scavland_pages.versions where page_id=p_page order by version desc limit 100) v),'[]'::jsonb);
 elsif p_action='revision' then
  if p_page is null or p_version is null or p_version<1 or p_request is not null then raise sqlstate '22023' using message='Invalid revision request.';end if;
  select to_jsonb(v) into result from scavland_pages.versions v where page_id=p_page and version=p_version;
  return result;
 elsif p_action='publication' then
  if p_page is not null or p_version is not null or p_request is null then raise sqlstate '22023' using message='Invalid status request.';end if;
  if not coalesce(public.is_scavland_owner(),false) then raise sqlstate '42501' using message='Owner permission required.';end if;
  select jsonb_build_object('publication',to_jsonb(p),'preview',r.preview,'saved',to_jsonb(v),'candidate',c.candidate)
   into result from scavland_pages.publications p join scavland_pages.previews r on r.request_id=p.preview_id
   join scavland_pages.versions v on v.page_id=r.page_id and v.version=r.version
   left join scavland_pages.git_candidates c on c.request_id=p.request_id where p.request_id=p_request and p.actor=caller_id;
  if result is null then raise sqlstate '42501' using message='Own publication required.';end if;
  return result;
 else raise sqlstate '22023' using message='Invalid read action.';end if;
end;$$;
revoke all on function scavland_pages.read_page_work(text,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.read_page_work(text,uuid,integer,uuid) to authenticated;
create function public.scavland_read_page_work(p_action text,p_page uuid default null,p_version integer default null,p_request uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.read_page_work(p_action,p_page,p_version,p_request);$$;
revoke all on function public.scavland_read_page_work(text,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.scavland_read_page_work(text,uuid,integer,uuid) to authenticated;
commit;
