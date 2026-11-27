
create table if not exists public.acc_acceptance_dispatch (
  singleton boolean primary key default true check(singleton),
  dispatch_token uuid,
  expires_at timestamptz,
  last_claimed_at timestamptz
);
alter table public.acc_acceptance_dispatch enable row level security;
revoke all on public.acc_acceptance_dispatch from public,anon,authenticated;
grant select,insert,update on public.acc_acceptance_dispatch to service_role;
insert into public.acc_acceptance_dispatch(singleton) values(true) on conflict do nothing;
create or replace function public.acc_acceptance_claim_dispatch(p_token uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare claimed boolean;
begin
 update public.acc_acceptance_dispatch set dispatch_token=null,last_claimed_at=now()
 where singleton and dispatch_token=p_token and expires_at>now() returning true into claimed;
 return coalesce(claimed,false);
end;$$;
revoke all on function public.acc_acceptance_claim_dispatch(uuid) from public,anon,authenticated;
grant execute on function public.acc_acceptance_claim_dispatch(uuid) to service_role;
create or replace function public.acc_acceptance_dispatch_job()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;
begin
 perform pg_advisory_xact_lock(72361127);
 if exists(select 1 from public.acc_loa_jobs where status in ('QUEUED','RUNNING')) then return; end if;
 t:=gen_random_uuid();
 update public.acc_acceptance_dispatch set dispatch_token=t,expires_at=now()+interval '2 minutes' where singleton
 and (dispatch_token is null or expires_at<now()) and (last_claimed_at is null or last_claimed_at<now()-interval '50 seconds');
 if not found then return; end if;
 perform net.http_post(url:='https://ipgs-admission-form.innovative.edu.my/api/admin-action',body:=jsonb_build_object('action','accAcceptanceWorker','dispatchToken',t),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=120000);
end;$$;
revoke all on function public.acc_acceptance_dispatch_job() from public,anon,authenticated;
grant execute on function public.acc_acceptance_dispatch_job() to service_role;
