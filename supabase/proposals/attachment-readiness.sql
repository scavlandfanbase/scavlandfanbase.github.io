-- Read-only release inventory. No draft contents, identities or secrets are returned.
-- Missing/partial objects require review; this query never authorizes activation.
with expected_tables(name) as (values
 ('scavland_item_drafts.attachment_prepared'),
 ('scavland_item_drafts.attachment_versions'),
 ('scavland_item_drafts.attachment_previews'),
 ('scavland_item_drafts.attachment_allocations')),
expected_functions(signature) as (values
 ('public.scavland_attachment_receipt(uuid,text,uuid,jsonb)'),
 ('public.scavland_prepare_attachment(uuid,text,uuid,jsonb,jsonb,integer)'),
 ('public.scavland_attachment_draft(text,text,uuid)'),
 ('public.scavland_attachment_list()'),
 ('public.scavland_attachment_preview(uuid,text,integer,text,uuid)'),
 ('public.scavland_allocate_attachment(uuid,uuid,jsonb)')),
expected_triggers(table_name,name) as (values
 ('scavland_item_drafts.versions','shared_item_attachment_overlap'),
 ('scavland_item_drafts.attachment_versions','attachment_shared_item_overlap'),
 ('scavland_item_drafts.attachment_prepared','attachment_creation_receipt_binding'),
 ('scavland_item_drafts.prepared','shared_creation_request_binding'))
select jsonb_build_object(
 'prerequisites',jsonb_build_object(
  'legacy_versions',to_regclass('scavland_drafts.versions') is not null,
  'shared_versions',to_regclass('scavland_item_drafts.versions') is not null,
  'shared_prepared',to_regclass('scavland_item_drafts.prepared') is not null,
  'auth_uid',to_regprocedure('auth.uid()') is not null,
  'permission',to_regprocedure('public.has_scavland_permission(text)') is not null,
  'legacy_rpc',to_regprocedure('public.scavland_item_legacy()') is not null),
 'tables',(select jsonb_agg(jsonb_build_object(
  'name',e.name,'present',c.oid is not null,'rls',c.relrowsecurity,
  'anon_direct',case when c.oid is not null then has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') end,
  'authenticated_direct',case when c.oid is not null then has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') end,
  'service_direct',case when c.oid is not null then has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') end))
  from expected_tables e left join pg_class c on c.oid=to_regclass(e.name)),
 'functions',(select jsonb_agg(jsonb_build_object(
  'signature',e.signature,'present',p.oid is not null,'security_definer',p.prosecdef,'settings',p.proconfig,
  'anon_execute',case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') end,
  'authenticated_execute',case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') end,
  'service_execute',case when p.oid is not null then has_function_privilege('service_role',p.oid,'EXECUTE') end))
  from expected_functions e left join pg_proc p on p.oid=to_regprocedure(e.signature)),
 'triggers',(select jsonb_agg(jsonb_build_object('table',e.table_name,'name',e.name,'present',t.oid is not null,'enabled',t.tgenabled))
  from expected_triggers e left join pg_trigger t on t.tgrelid=to_regclass(e.table_name) and t.tgname=e.name and not t.tgisinternal)
) as attachment_release_inventory;
