
alter table public.acc_loa_issuance add column if not exists revision integer not null default 1 check(revision between 1 and 1000);
alter table public.acc_loa_jobs add column if not exists revision integer not null default 1 check(revision between 1 and 1000);
alter table public.acc_loa_jobs drop constraint acc_loa_jobs_kind_check;
alter table public.acc_loa_jobs add constraint acc_loa_jobs_kind_check check(kind in ('ISSUE','REVISE'));
create table public.acc_loa_revision_requests (
 reference_no text primary key,
 plan jsonb not null,
 revision integer not null check(revision between 2 and 1000),
 actor text not null,
 state text not null default 'DRAFT' check(state in ('DRAFT','QUEUED','COMPLETED')),
 updated_at timestamptz not null default now()
);
alter table public.acc_loa_revision_requests enable row level security;
revoke all on public.acc_loa_revision_requests from public,anon,authenticated;
grant select,insert,update on public.acc_loa_revision_requests to service_role;
create or replace function public.acc_loa_save_revision(p_ref text,p_plan jsonb,p_actor text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare l public.acc_loa_issuance%rowtype;
begin
 perform pg_advisory_xact_lock(72361127);
 select * into l from public.acc_loa_issuance where reference_no=p_ref for update;
 if not found or l.status<>'SENT' or l.gmail_message_id is null or l.gmail_message_id is distinct from (p_plan#>>'{previous,emailMessageId}') or l.revision+1<> (p_plan->>'revision')::integer then raise exception 'Prior issuance changed'; end if;
 if exists(select 1 from public.acc_loa_jobs where reference_no=p_ref and status<>'SENT') then raise exception 'Prior job not settled'; end if;
 insert into public.acc_loa_revision_requests(reference_no,plan,revision,actor,state)
 values(p_ref,p_plan,l.revision+1,p_actor,'DRAFT')
 on conflict(reference_no) do update set plan=excluded.plan,revision=excluded.revision,actor=excluded.actor,state='DRAFT',updated_at=now()
 where acc_loa_revision_requests.state in ('DRAFT','COMPLETED');
 return found;
end;$$;
create or replace function public.acc_loa_enqueue_revision(p_ref text,p_revision integer)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare d public.acc_loa_revision_requests%rowtype; l public.acc_loa_issuance%rowtype;
begin
 perform pg_advisory_xact_lock(72361127);
 select * into d from public.acc_loa_revision_requests where reference_no=p_ref and revision=p_revision and state='DRAFT' for update;
 if not found then return false; end if;
 select * into l from public.acc_loa_issuance where reference_no=p_ref and status='SENT' and revision=p_revision-1 for update;
 if not found or l.gmail_message_id is distinct from (d.plan#>>'{previous,emailMessageId}') then raise exception 'Prior issuance changed'; end if;
 insert into public.acc_loa_jobs(reference_no,matric_no,study_mode,actor,status,kind,revision)
 values(p_ref,l.matric_no,d.plan->>'nextStudyMode',d.actor,'QUEUED','REVISE',p_revision)
 on conflict(reference_no) do update set matric_no=excluded.matric_no,study_mode=excluded.study_mode,actor=excluded.actor,status='QUEUED',kind='REVISE',revision=p_revision,dispatch_token=null,dispatch_at=null,started_at=null,updated_at=now(),failure_reason=null
 where acc_loa_jobs.status='SENT';
 if not found then return false; end if;
 update public.acc_loa_revision_requests set state='QUEUED',updated_at=now() where reference_no=p_ref;
 return true;
end;$$;
create or replace function public.acc_loa_archive_revision(p_ref text,p_revision integer)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare d public.acc_loa_revision_requests%rowtype;l public.acc_loa_issuance%rowtype;p jsonb;
begin
 perform pg_advisory_xact_lock(72361127);
 if not exists(select 1 from public.acc_loa_jobs where reference_no=p_ref and kind='REVISE' and revision=p_revision and status='RUNNING') then raise exception 'No revision claim';end if;
 select * into d from public.acc_loa_revision_requests where reference_no=p_ref and revision=p_revision and state='QUEUED';if not found then raise exception 'No revision plan';end if;
 select * into l from public.acc_loa_issuance where reference_no=p_ref and revision=p_revision-1 and status='SENT' for update;if not found or l.gmail_message_id is distinct from (d.plan#>>'{previous,emailMessageId}') then raise exception 'Prior issuance changed';end if;
 p:=d.plan->'previous';
 insert into public.acc_loa_revision_history(reference_no,revision,study_mode,superseded_by,acceptance_status,offer_issued_at,accepted_at,gmail_message_id,pdf_files,signed_document_urls,reason,actor)
 values(p_ref,p_revision-1,p->>'studyMode',p_revision,p->>'acceptanceStatus',(p->>'offerIssuedAt')::timestamptz,nullif(p->>'acceptedAt','')::timestamptz,l.gmail_message_id,l.pdf_files,p->'signedDocumentUrls',d.plan->>'reason',d.actor);
 return true;
end;$$;
create or replace function public.acc_loa_release_revision_ledger(p_ref text,p_revision integer)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72361127);
 if not exists(select 1 from public.acc_loa_jobs where reference_no=p_ref and kind='REVISE' and revision=p_revision and status='RUNNING') then raise exception 'No revision claim'; end if;
 delete from public.acc_loa_issuance l using public.acc_loa_revision_history h where l.reference_no=p_ref and h.reference_no=p_ref and l.revision=p_revision-1 and h.revision=l.revision and l.status='SENT' and l.gmail_message_id=h.gmail_message_id;
 return found;
end;$$;
revoke all on function public.acc_loa_save_revision(text,jsonb,text),public.acc_loa_enqueue_revision(text,integer),public.acc_loa_archive_revision(text,integer),public.acc_loa_release_revision_ledger(text,integer) from public,anon,authenticated;
grant execute on function public.acc_loa_save_revision(text,jsonb,text),public.acc_loa_enqueue_revision(text,integer),public.acc_loa_archive_revision(text,integer),public.acc_loa_release_revision_ledger(text,integer) to service_role;

create or replace function public.acc_loa_complete_revision(p_ref text,p_revision integer)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(72361127);
 if not exists(select 1 from public.acc_loa_issuance where reference_no=p_ref and revision=p_revision and status='SENT' and gmail_message_id is not null) then return false;end if;
 if not exists(select 1 from public.acc_loa_revision_requests where reference_no=p_ref and revision=p_revision and state='QUEUED') then return false;end if;
 update public.acc_loa_jobs set status='SENT',updated_at=now() where reference_no=p_ref and revision=p_revision and kind='REVISE' and status='RUNNING';
 if not found then return false;end if;
 update public.acc_loa_revision_requests set state='COMPLETED',updated_at=now() where reference_no=p_ref;
 return true;
end;$$;
revoke all on function public.acc_loa_complete_revision(text,integer) from public,anon,authenticated;
grant execute on function public.acc_loa_complete_revision(text,integer) to service_role;
