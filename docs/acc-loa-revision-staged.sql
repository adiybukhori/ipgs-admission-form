-- STAGED ONLY: apply together with revision worker and acceptance cutover, not in isolation.
create table public.acc_loa_revision_history (
 reference_no text not null,
 revision integer not null check(revision between 1 and 1000),
 study_mode text not null check(study_mode in ('Full-Time','Part-Time')),
 superseded_by integer not null check(superseded_by=revision+1),
 acceptance_status text not null check(acceptance_status in ('PENDING','ACCEPTED')),
 offer_issued_at timestamptz not null,
 accepted_at timestamptz,
 gmail_message_id text not null,
 pdf_files jsonb not null check(jsonb_typeof(pdf_files)='array' and jsonb_array_length(pdf_files)=4),
 signed_document_urls jsonb not null check(jsonb_typeof(signed_document_urls)='array' and jsonb_array_length(signed_document_urls) in (0,4)),
 reason text not null check(length(trim(reason)) between 1 and 300),
 actor text not null,
 archived_at timestamptz not null default now(),
 primary key(reference_no,revision),
 check((acceptance_status='ACCEPTED' and accepted_at is not null and jsonb_array_length(signed_document_urls)=4) or (acceptance_status='PENDING' and jsonb_array_length(signed_document_urls)=0))
);
alter table public.acc_loa_revision_history enable row level security;
revoke all on public.acc_loa_revision_history from public,anon,authenticated,service_role;
grant select,insert on public.acc_loa_revision_history to service_role;
-- Keep the history append-only. Do not store acceptance URLs/tokens or credentials here.
-- Revision reservation and issuance state transitions still need worker integration.
