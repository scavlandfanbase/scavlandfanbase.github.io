begin;
-- Page Builder uses content_edit for shared private drafts; publishing remains
-- Owner-only, and other public content routes require publish_public as well.
update public.admin_users
set permissions=array(select distinct p from unnest(permissions||array['content_edit']) p)
where role='reviewer';
commit;
