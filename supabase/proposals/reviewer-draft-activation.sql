begin;
-- Apply only AFTER every production publication route enforces publish_public.
update public.admin_users set permissions=array['evidence_review','items_edit','weapons_edit','armour_edit','ammunition_edit','vendors_edit'] where role='reviewer';
commit;
