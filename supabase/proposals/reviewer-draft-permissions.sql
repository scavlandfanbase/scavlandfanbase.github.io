begin;
-- Editing does not authorize publication, even if a Reviewer is accidentally
-- assigned the publication permission by an older account-management client.
create or replace function public.has_scavland_permission(required_permission text)
returns boolean language sql stable security definer set search_path='public' as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid()
 and is_active=true and (role='owner' or
 (required_permission=any(permissions) and
 (required_permission<>'publish_public' or role='admin'))));
$$;
update public.admin_users set permissions=array(select distinct p from unnest(permissions||array['publish_public']) p) where role='admin';
commit;
