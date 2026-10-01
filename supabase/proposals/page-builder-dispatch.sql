-- Unapplied; after git-candidate. Service-only single dispatch and proven no-write refusal.
begin;
alter table scavland_pages.git_candidates add column attempt_id uuid;
alter table scavland_pages.publications drop constraint publications_state_check;
alter table scavland_pages.publications add constraint publications_state_check check(state in ('prepared','committed','build-failed','live','refused'));
drop index scavland_pages.page_one_pending_publication;
create unique index page_one_pending_publication on scavland_pages.publications(page_id) where state not in ('live','refused');
create function scavland_pages.page_dispatch(p_request uuid,p_attempt uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt scavland_pages.publications;candidate_row scavland_pages.git_candidates;
begin
 if p_request is null or p_attempt is null or p_action is null or p_action not in ('claim','refuse-no-write') then raise sqlstate '22023' using message='Invalid dispatch operation.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-publish-request:'||p_request::text,0));
 select * into receipt from scavland_pages.publications where request_id=p_request;
 if not found then raise sqlstate 'PT409' using message='Reservation missing.';end if;
 select * into candidate_row from scavland_pages.git_candidates where request_id=p_request;
 if not found then raise sqlstate 'PT409' using message='Durable candidate missing.';end if;
 if p_action='claim' then
  if receipt.state<>'prepared' or candidate_row.attempt_id is not null then return jsonb_build_object('acquired',false);end if;
  update scavland_pages.git_candidates set attempt_id=p_attempt where request_id=p_request;
  return jsonb_build_object('acquired',true);
 end if;
 -- Only the original claimed worker may report its known no-write branch.
 -- Network failure/rejection after dispatch is NOT a no-write outcome.
 if candidate_row.attempt_id is distinct from p_attempt or receipt.state not in ('prepared','refused') then raise sqlstate 'PT409' using message='No-write refusal does not match dispatch.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 update scavland_pages.publications set state='refused',updated_at=clock_timestamp() where request_id=p_request returning * into receipt;
 return to_jsonb(receipt);
end;$$;
revoke all on function scavland_pages.page_dispatch(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function scavland_pages.page_dispatch(uuid,uuid,text) to service_role;
create function public.scavland_page_dispatch(p_request uuid,p_attempt uuid,p_action text)
returns jsonb language sql security invoker set search_path='' as $$select scavland_pages.page_dispatch(p_request,p_attempt,p_action);$$;
revoke all on function public.scavland_page_dispatch(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.scavland_page_dispatch(uuid,uuid,text) to service_role;
create or replace function scavland_pages.guard_pending_publication()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('page-catalogue-write',0));
 if exists(select 1 from scavland_pages.publications where page_id=new.page_id and state not in ('live','refused')) then
 raise sqlstate 'PT409' using message='Page publication is pending. Keep your edits.';end if;
 return new;
end;$$;
create function scavland_pages.guard_refused_publication()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.state='refused' and (new.state<>'refused' or new.commit_sha is not null) then
 raise sqlstate 'PT409' using message='Refused publication cannot dispatch again.';end if;
 return new;
end;$$;
revoke all on function scavland_pages.guard_refused_publication() from public,anon,authenticated,service_role;
create trigger page_refused_terminal before update on scavland_pages.publications for each row execute function scavland_pages.guard_refused_publication();
commit;
