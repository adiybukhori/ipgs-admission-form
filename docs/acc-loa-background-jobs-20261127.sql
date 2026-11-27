
create table if not exists public.acc_loa_jobs (
 reference_no text primary key,
 matric_no text not null check (matric_no ~ '^[0-9]{7}$'),
 study_mode text not null check(study_mode in ('Full-Time','Part-Time')),
 actor text not null,
 status text not null default 'QUEUED' check(status in ('QUEUED','RUNNING','SENT','REVIEW_REQUIRED')),
 dispatch_token uuid,
 dispatch_at timestamptz,
 started_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 failure_reason text,
 kind text not null default 'ISSUE' check(kind='ISSUE')
);
alter table public.acc_loa_jobs enable row level security;
revoke all on public.acc_loa_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.acc_loa_jobs to service_role;
create or replace function public.acc_loa_claim_job(p_token uuid)
returns setof public.acc_loa_jobs language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72361127);
 if exists(select 1 from public.acc_loa_jobs where status='RUNNING') then return; end if;
 return query update public.acc_loa_jobs set status='RUNNING',started_at=now(),updated_at=now(),dispatch_token=null
 where status='QUEUED' and dispatch_token=p_token and dispatch_at>now()-interval '2 minutes'
 returning *;
end;$$;
revoke all on function public.acc_loa_claim_job(uuid) from public,anon,authenticated;
grant execute on function public.acc_loa_claim_job(uuid) to service_role;
create or replace function public.acc_loa_dispatch_job()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.acc_loa_jobs%rowtype; t uuid;
begin
 perform pg_advisory_xact_lock(72361127);
 update public.acc_loa_jobs j set status='REVIEW_REQUIRED',failure_reason='Worker stopped before verified completion; no automatic retry',updated_at=now(),dispatch_token=null
 where status='RUNNING' and started_at<now()-interval '7 minutes';
 if exists(select 1 from public.acc_loa_jobs where status='RUNNING' or (status='QUEUED' and dispatch_at>now()-interval '2 minutes')) then return; end if;
 select * into r from public.acc_loa_jobs where status='QUEUED' order by created_at for update skip locked limit 1;
 if not found then return; end if;
 t:=gen_random_uuid();
 update public.acc_loa_jobs set dispatch_token=t,dispatch_at=now(),updated_at=now() where reference_no=r.reference_no;
 perform net.http_post(url:='https://ipgs-admission-form.innovative.edu.my/api/admin-action',body:=jsonb_build_object('action','accLoaWorker','dispatchToken',t),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=300000);
end;$$;
revoke all on function public.acc_loa_dispatch_job() from public,anon,authenticated;
grant execute on function public.acc_loa_dispatch_job() to service_role;
