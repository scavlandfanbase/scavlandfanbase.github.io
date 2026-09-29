-- SCAVLAND Evidence Review authorization
-- Production policy state verified 29 September 2026.
-- Evidence moderation requires the granular evidence_review permission.
-- Owners retain access through has_scavland_permission().

alter policy admins_read_submissions
on public.evidence_submissions
using (public.has_scavland_permission('evidence_review'));

alter policy admins_update_submissions
on public.evidence_submissions
using (public.has_scavland_permission('evidence_review'))
with check (public.has_scavland_permission('evidence_review'));

alter policy admins_delete_submissions
on public.evidence_submissions
using (public.has_scavland_permission('evidence_review'));
