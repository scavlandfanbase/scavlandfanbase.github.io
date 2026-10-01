-- Read-only inventory: works before and after proposal application. No evidence text or secrets.
select n.nspname as schema_name,c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname='evidence_submissions')
 or (n.nspname='scavland_evidence_review' and c.relname='reviews');
select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef as security_definer,p.proconfig,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
 has_function_privilege('anon',p.oid,'execute') as anonymous_execute,
 has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('scavland_review_evidence','scavland_evidence_state','scavland_evidence_queue'))
 or (n.nspname='scavland_evidence_review' and p.proname='decide');
select grantee,table_schema,table_name,privilege_type from information_schema.role_table_grants
where (table_schema='public' and table_name='evidence_submissions')
 or (table_schema='scavland_evidence_review' and table_name='reviews');
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where tablename='evidence_submissions';
select schemaname,tablename,indexname,indexdef from pg_indexes
where schemaname='public' and indexname='evidence_review_queue_order';

-- Explicit column ACLs can survive table-level revocation: require review if present.
select a.attname,a.attacl from pg_attribute a
where a.attrelid=to_regclass('public.evidence_submissions')
 and a.attnum>0 and not a.attisdropped and a.attacl is not null;
