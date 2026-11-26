-- ACC-native LOA issuance ledger (STAGED, NOT APPLIED).
-- Must be created with a reviewed Supabase migration before native LOA is enabled.
-- RLS prevents staff/browser direct access; only server-side service role may write.
create table if not exists public.acc_loa_issuance (
  reference_no text primary key,
  matric_no varchar(7) not null check (matric_no ~ '^[0-9]{7}$'),
  status text not null check (status in (
    'PREPARING','PDFS_READY','SENDING','SENT','REVIEW_REQUIRED')),
  actor text not null,
  recipient text,
  pdf_files jsonb not null default '[]'::jsonb,
  gmail_message_id text,
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.acc_loa_issuance enable row level security;
revoke all on public.acc_loa_issuance from public, anon, authenticated;
grant select, insert, update on public.acc_loa_issuance to service_role;
comment on table public.acc_loa_issuance is
'One issuance claim per ACC application; prevents duplicate Gmail send even after uncertain outcome.';
-- The status REVIEW_REQUIRED requires manual Registry review, never an automatic retry.
