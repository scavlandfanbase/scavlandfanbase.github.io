-- The Owner-authorized manage-admin-users Edge Function requires these privileges.
-- Browser roles retain no direct writes; RLS stays enabled.
grant select, insert, update on public.admin_users to service_role;
