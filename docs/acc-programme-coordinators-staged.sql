-- STAGED ONLY: do not execute against production until ACC LOA cutover is approved.
-- ACC Programme Coordinator Directory. Existing approved programmes seeded safely.
create table if not exists public.acc_programme_coordinators (
  programme_code varchar(15) primary key check (programme_code ~ '^[A-Z][A-Z0-9]{1,14}$'),
  programme_name varchar(180) not null,
  level varchar(40) not null check (level in ('Postgraduate Diploma','Bachelor','Master','Doctorate')),
  coordinator_name varchar(180) not null default '',
  coordinator_email varchar(240) not null default '',
  coordinator_role varchar(160) not null default '',
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'IPGS Registry',
  constraint coordinator_complete_when_active check (
    not is_active or (
      length(trim(coordinator_name))>=3
      and coordinator_email ~* '^[a-z0-9._%+-]+@innovative\.edu\.my$'
      and length(trim(coordinator_role))>=4
    )
  ),
  constraint no_diploma_dba_odl check (programme_code not in ('DBAODL','DPLI')),
  constraint dba_must_be_doctorate check (programme_code<>'DBA' or (programme_name not ilike '%ODL%' and programme_name not ilike '%Diploma%'))
);
alter table public.acc_programme_coordinators enable row level security;
revoke all on public.acc_programme_coordinators from public, anon, authenticated;
grant select, insert, update on public.acc_programme_coordinators to service_role;
comment on table public.acc_programme_coordinators is 'Single ACC directory. LOA blocked unless matching active complete PIC. Never rely on bundled preview defaults.';

-- INSERT ONLY: do not overwrite staff edits on repeat migrations.
insert into public.acc_programme_coordinators
 (programme_code,programme_name,level,coordinator_name,coordinator_email,coordinator_role,is_active)
values
 ('PGDT','Postgraduate Diploma in Teaching','Postgraduate Diploma','Rushdina Arifah Rushdan','rushdina@innovative.edu.my','PGDT Programme Coordinator',true),
 ('MBA','Master of Business Administration','Master','Muhammad Naqiyuddin Bin Mohd Jihat','naqiyuddin.ipgs@innovative.edu.my','MBA Programme Coordinator',true),
 ('MBM','Master in Business Management','Master','Abuzar Bin Azizan','abuzar@innovative.edu.my','MBM Programme Coordinator',true),
 ('MHUM','Master in Hajj & Umrah Management','Master','Muhammad Naqiyuddin Bin Mohd Jihat','naqiyuddin.ipgs@innovative.edu.my','MHUM Programme Coordinator',true),
 ('MIS','Master in Islamic Studies','Master','Aminah Binti Abdullah','aminah.abdullah@innovative.edu.my','MIS Programme Coordinator',true),
 ('PHD','Doctor of Philosophy in Management','Doctorate','Noorus Sarah','noorus.sarah@innovative.edu.my','PhD Programme Coordinator',true),
 ('DBA','Doctorate of Business Administration','Doctorate','Noorus Sarah','noorus.sarah@innovative.edu.my','DBA Programme Coordinator',true),
 ('MEDU','Master in Education','Master','Muhammad Abu Huzaifah Bin Zulkifli','abu.huzaifah.ipgs@innovative.edu.my','MEDU Programme Coordinator',true),
 ('BBA','Bachelor in Business Administration','Bachelor','Muhammad Naqiyuddin Bin Mohd Jihat','naqiyuddin.ipgs@innovative.edu.my','BBA Programme Coordinator',true)
on conflict (programme_code) do nothing;
-- DPLI is an alias for PGDT. MBA+PhD and MBM+PhD inherit their Master's programme.
-- Do not add DBA ODL Diploma.
