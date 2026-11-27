import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.argv[2];function edit(p,f){let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');let n=f(s);assert.notEqual(s,n,p);fs.writeFileSync(p,n);}
function one(s,a,b){assert.equal(s.split(a).length,2,a.slice(0,130));return s.replace(a,()=>b);}
edit('api/admin-action.js',s=>{
s=one(s,"function accRevisionEnabled(){","function stableRevisionJson(x){return JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}\nfunction accRevisionEnabled(){");
s=one(s,"JSON.stringify(now)!==JSON.stringify(p)","stableRevisionJson(now)!==stableRevisionJson(p)");
s=one(s,"JSON.stringify(current)!==JSON.stringify(p)","stableRevisionJson(current)!==stableRevisionJson(p)");
return s;});
edit('lib/loa-revision.js',s=>one(s,"revisionDate(workflow['Offer Letter Issued At']||ledger.sent_at)","revisionDate(ledger.sent_at||workflow['Offer Letter Issued At'])"));
edit('admin.html',s=>{
s=one(s,"function accAcceptanceBadge(r){if(accLoaJobs.get(r.ref)?.kind==='REVISE'&&accLoaBusy(r))","function accRevisionWorkflowStale(r){const revision=Number(accLoaLedger.get(r?.ref)?.revision||1),match=String(r?.workflow?.['Offer Letter Remarks']||'').match(/; Revision R(\\d{2,4})$/);return revision>(match?Number(match[1]):1);}\n    function accAcceptanceBadge(r){if(accRevisionWorkflowStale(r)&&!accLoaBusy(r)&&accLoaJobState(r)==='SENT')return '<span class=\"badge amber\">Pending Submission</span>';if(accLoaJobs.get(r.ref)?.kind==='REVISE'&&accLoaBusy(r))");
s=one(s,"if(accRevisionReady&&Number(accLoaLedger.get(r.ref)?.revision||1)>1)","if(accRevisionReady&&(Number(accLoaLedger.get(r.ref)?.revision||1)>1||accLoaJobs.get(r.ref)?.kind==='REVISE'))");
s=one(s,"if(!accLoaBusy(r)&&accLoaJobState(r)!=='REVIEW_REQUIRED'&&String(r.workflow?.['Acceptance Status']","if(!accRevisionWorkflowStale(r)&&!accLoaBusy(r)&&accLoaJobState(r)!=='REVIEW_REQUIRED'&&String(r.workflow?.['Acceptance Status']");
s=one(s,"||accLoaBusy(r)||accLoaJobState(r)==='REVIEW_REQUIRED';const picker=","||accLoaBusy(r)||accRevisionWorkflowStale(r)||accLoaJobState(r)==='REVIEW_REQUIRED';const picker=");
return s;});
edit(path.join(root,'WorkflowV2.js'),s=>{
s=one(s,"  // Audit snapshot exists in database before this operation. Preserve all signed and issued files.","  // Verify all preserved files before changing any sheet state.\n  const folderId=v2OfferExtractDriveId_(a.record['Student Folder URL']);if(!folderId)throw Error('Student folder missing');\n  const original=old.pdfFiles||[];if(original.length!==4||new Set(original.map(x=>x.id)).size!==4)throw Error('Original PDF set incomplete');\n  const checkFile=(id,name,prefix)=>{const file=DriveApp.getFileById(id),parents=file.getParents();let inside=false;while(parents.hasNext())if(parents.next().getId()===folderId)inside=true;if(!inside||file.isTrashed()||file.getMimeType()!==MimeType.PDF||(name&&file.getName()!==name)||(prefix&&!file.getName().startsWith(prefix)))throw Error('Preserved PDF not verified');};\n  original.forEach(f=>{if(v2OfferExtractDriveId_(f.url)!==f.id)throw Error('Prior PDF URL mismatch');checkFile(f.id,f.name,'');});\n  signed.forEach(u=>checkFile(v2OfferExtractDriveId_(u),'','SIGNED_'));\n  // Audit snapshot exists in database before this operation. Preserve all signed and issued files.");
s=one(s,"let remaining=0;const folderId=v2OfferExtractDriveId_(a.record['Student Folder URL']);","let remaining=0;");
s=one(s,"  const reset={","  const reviewIds=reviewKeys.map(k=>v2OfferExtractDriveId_(r[k]));\n  const reset={");s=one(s,"for(const k of reviewKeys){const id=v2OfferExtractDriveId_(r[k]);if(!id)continue;","for(const id of reviewIds){if(!id)continue;");
return s;});
edit('scripts/test-acc-loa-revision.mjs',s=>{
s=one(s,"gmail_message_id:'synthetic',pdf_files:pdfs","gmail_message_id:'synthetic',sent_at:'2026-11-27T08:00:00Z',pdf_files:pdfs");
s=one(s,"'Acceptance Pack Status':'ACCEPTED','Acceptance Confirmation Email Status':'LIVE_SENT_1'","'Acceptance Pack Status':'ACCEPTED','Acceptance Signed At':'2026-11-27T08:05:00Z','Acceptance Confirmation Email Status':'LIVE_SENT_1'");return s;});
const sql='docs/acc-loa-revision-worker-staged.sql';fs.appendFileSync(sql,String.raw`
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
`);
console.log('Canonical plan comparison, signed file validation and atomic completion added.');