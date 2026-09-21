create table if not exists public.site_sessions (
  session_id text primary key check (session_id ~ '^[a-zA-Z0-9-]{20,80}$'),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_page text not null default '/',
  constraint site_sessions_page_length check (char_length(last_page) <= 200)
);

revoke all on public.site_sessions from anon, authenticated;

create or replace function public.track_site_session(p_session_id text, p_page text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null or p_session_id !~ '^[a-zA-Z0-9-]{20,80}$' then
    raise exception 'Invalid session id';
  end if;
  insert into public.site_sessions(session_id, last_page)
  values (p_session_id, left(coalesce(nullif(p_page, ''), '/'), 200))
  on conflict (session_id) do update
    set last_seen = now(), last_page = excluded.last_page;
end;
$$;

grant execute on function public.track_site_session(text, text) to anon, authenticated;

create or replace function public.get_site_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_scavland_admin() then
    raise exception 'Admin access is required';
  end if;
  select jsonb_build_object(
    'activeNow', count(*) filter (where last_seen >= now() - interval '5 minutes'),
    'last24Hours', count(*) filter (where last_seen >= now() - interval '24 hours'),
    'totalSessions', count(*),
    'updatedAt', now()
  ) into result
  from public.site_sessions;
  return result;
end;
$$;

grant execute on function public.get_site_analytics() to authenticated;
