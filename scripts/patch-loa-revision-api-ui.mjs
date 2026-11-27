import fs from 'node:fs';import assert from 'node:assert/strict';
function edit(p,fn){let s=fs.readFileSync(p,'utf8');const nl=s.includes('\r\n')?'\r\n':'\n';s=s.replace(/\r\n/g,'\n');const n=fn(s);assert.notEqual(n,s,p);fs.writeFileSync(p,n.replace(/\n/g,nl));}
function one(s,a,b){assert.equal(s.split(a).length,2,'Expected exactly one match: '+a.slice(0,120));return s.replace(a,()=>b);}
edit('lib/loa-revision.js',s=>one(s,'referenceNo,revision:revision+1,nextStudyMode:next,reason:reason.trim(),expectedOfferUrl:', 'referenceNo,revision:revision+1,nextStudyMode:next,reason:reason.trim(),registryConfirmed:registryConfirmed===true,expectedOfferUrl:'));
edit('api/admin-action.js',s=>{
s=one(s,"import {accGatewayCall} from '../lib/loa-gateway.js';","import {accGatewayCall} from '../lib/loa-gateway.js';\nimport {prepareLoaRevision,normalizeStudyMode} from '../lib/loa-revision.js';");
s=one(s,"'accIssueLoa','accLoaStatus','accSetStudyMode'","'accIssueLoa','accLoaStatus','accSaveLoaRevision','accQueueLoaRevision','accLoaHistory','accSetStudyMode'");
s=one(s,"async function accLoaInput(referenceNo,requestedMatric){","async function accLoaInput(referenceNo,requestedMatric,revisionPreflight=false){");
s=one(s,"  const prepared=accNativeLoaValidate({referenceNo,matricNo:matric,application,workflow});","  const checkedWorkflow=revisionPreflight?{...workflow,'Offer Letter Status':'NOT_ISSUED','Offer Letter PDF URL':'','Offer Letter Issued At':''}:workflow;\n  const prepared=accNativeLoaValidate({referenceNo,matricNo:matric,application,workflow:checkedWorkflow});");
s=one(s,"async function accLoaWorker(body,res){",`
function accRevisionEnabled(){return process.env.ACC_LOA_REVISION_READY==='true'&&process.env.ACC_LOA_QUEUE_READY==='true'&&accNativeLoaReadiness().ready;}
async function accRevisionPlan(ref,data,{running=false}={}){
 if(!accRevisionEnabled()||!/^IUC-ADM-[A-Za-z0-9-]{3,160}$/.test(ref))throw Error('Revised LOA is not enabled.');
 const [ls,js]=await Promise.all([supabaseRequest('acc_loa_issuance?select=*&reference_no=eq.'+encodeURIComponent(ref)+'&limit=1'),supabaseRequest('acc_loa_jobs?select=*&reference_no=eq.'+encodeURIComponent(ref)+'&limit=1')]);
 if(!Array.isArray(ls)||ls.length!==1||!Array.isArray(js))throw Error('Prior LOA not verified');
 const ledger=ls[0],job=js[0]||null,input=await accLoaInput(ref,ledger.matric_no,true);
 if(!running&&normalizeStudyMode(data.expectedStudyMode)!==input.prepared.studyMode)throw Error('Current Study Mode changed; refresh first');
 if(running&&(!job||job.status!=='RUNNING'||job.kind!=='REVISE'))throw Error('No revision job claimed');
 const plan=prepareLoaRevision({referenceNo:ref,application:input.application,workflow:input.workflow,ledger,job:running?null:job,nextStudyMode:data.studyMode,reason:data.reason,registryConfirmed:data.registryConfirmed===true,revision:Number(ledger.revision||1)});
 const cc=JSON.parse(process.env.ACC_LOA_CC_ROUTING_JSON||'{}')[input.prepared.code];
 if(!Array.isArray(cc)||cc.length!==1||cc[0].toLowerCase()!==input.coordinator.email)throw Error('Coordinator routing not verified');
 return plan;
}
async function accPrepareRevisionJob(job){
 if(!accRevisionEnabled()||!process.env.V2_WORKFLOW_API_TOKEN)throw Error('Revision backend not configured');
 const ref=job.reference_no,revision=Number(job.revision);
 const drafts=await supabaseRequest('acc_loa_revision_requests?select=plan,state,revision&reference_no=eq.'+encodeURIComponent(ref)+'&limit=1');
 const d=drafts?.[0];if(!d||d.state!=='QUEUED'||d.revision!==revision||d.plan.nextStudyMode!==job.study_mode)throw Error('Revision draft not verified');
 const p=d.plan,now=await accRevisionPlan(ref,{studyMode:p.nextStudyMode,reason:p.reason,registryConfirmed:p.registryConfirmed},{running:true});
 if(JSON.stringify(now)!==JSON.stringify(p))throw Error('Prior offer or acceptance changed; Registry review required');
 const health=await accGatewayCall(process.env,'health',{});
 if(health?.loaRevisionSupport!==1||health?.writeEnabled!==true)throw Error('Revision gateway not ready');
 if(await supabaseRequest('rpc/acc_loa_archive_revision','POST',{p_ref:ref,p_revision:revision})!==true)throw Error('Original LOA not archived');
 const bridge=await callAppsScriptV2('v2PrepareAccLoaRevision',p,'','Registry LOA Revision');
 if(bridge.parsed?.tokenRevoked!==true||bridge.parsed.revision!==revision||bridge.parsed.studyMode!==job.study_mode||bridge.parsed.reviewFilesRemaining!==0)throw Error('Revision reset requires manual review');
 const input=await accLoaInput(ref,job.matric_no);
 if(input.prepared.studyMode!==job.study_mode||input.workflow['Offer Letter Remarks']!=='ACC revised LOA preparing; Revision R'+String(revision).padStart(2,'0')||input.workflow['Acceptance Token Hash']||input.workflow['Acceptance Signing URL'])throw Error('Revision reset not independently verified');
 if(await supabaseRequest('rpc/acc_loa_release_revision_ledger','POST',{p_ref:ref,p_revision:revision})!==true)throw Error('Prior ledger not safely released');
 return input;
}
async function accLoaWorker(body,res){`);
s=one(s,"    const input=await accLoaInput(job.reference_no,job.matric_no);","    const revised=job.kind==='REVISE';\n    const input=revised?await accPrepareRevisionJob(job):await accLoaInput(job.reference_no,job.matric_no);");
s=one(s,"const result=await issueAccNativeLoa({...input,actor:job.actor,emailContract:renderLegacyLoaEmail});","const result=await issueAccNativeLoa({...input,actor:job.actor,emailContract:renderLegacyLoaEmail,revision:revised?Number(job.revision):1});");
s=one(s,"    await supabaseRequest('acc_loa_jobs?reference_no=eq.'+encodeURIComponent(job.reference_no)+'&status=eq.RUNNING','PATCH',{status:'SENT',updated_at:new Date().toISOString()});","    if(revised){if(await supabaseRequest('rpc/acc_loa_complete_revision','POST',{p_ref:job.reference_no,p_revision:Number(job.revision)})!==true)throw Error('Revision completion requires review');}\n    else await supabaseRequest('acc_loa_jobs?reference_no=eq.'+encodeURIComponent(job.reference_no)+'&status=eq.RUNNING','PATCH',{status:'SENT',updated_at:new Date().toISOString()});");
s=one(s,"    }else if(action==='accLoaStatus'){",`    }else if(['accSaveLoaRevision','accQueueLoaRevision','accLoaHistory'].includes(action)){
      if(!(await validateDirectAdmin(password)))throw Error('Admin authentication required');
      if(!accRevisionEnabled())throw Error('Revised LOA is not enabled');
      const ref=String(body.data?.referenceNo||'').trim();if(!/^IUC-ADM-[A-Za-z0-9-]{3,160}$/.test(ref))throw Error('Invalid application reference');
      if(action==='accSaveLoaRevision'){
        const p=await accRevisionPlan(ref,body.data);
        if(await supabaseRequest('rpc/acc_loa_save_revision','POST',{p_ref:ref,p_plan:p,p_actor:String(body.updatedBy||'Registry').slice(0,120)})!==true)throw Error('Revision draft not saved');
        result={referenceNo:ref,revision:p.revision,studyMode:p.nextStudyMode,state:'DRAFT'};
      }else if(action==='accQueueLoaRevision'){
        const ds=await supabaseRequest('acc_loa_revision_requests?select=plan,state,revision&reference_no=eq.'+encodeURIComponent(ref)+'&limit=1');
        const d=ds?.[0];if(!d||d.state!=='DRAFT'||d.revision!==Number(body.data?.revision))throw Error('Save a fresh revision draft first');
        const p=d.plan,current=await accRevisionPlan(ref,{studyMode:p.nextStudyMode,reason:p.reason,expectedStudyMode:p.previous.studyMode,registryConfirmed:p.registryConfirmed});
        if(JSON.stringify(current)!==JSON.stringify(p))throw Error('Acceptance changed since draft; save again');
        if(await supabaseRequest('rpc/acc_loa_enqueue_revision','POST',{p_ref:ref,p_revision:d.revision})!==true)throw Error('Revision already queued or prior job not settled');
        try{await supabaseRequest('rpc/acc_loa_dispatch_job','POST',{});}catch(_){}
        result={referenceNo:ref,revision:d.revision,jobStatus:'QUEUED'};
      }else{
        const history=await supabaseRequest('acc_loa_revision_history?select=revision,study_mode,superseded_by,acceptance_status,offer_issued_at,accepted_at,pdf_files,signed_document_urls,reason,archived_at&reference_no=eq.'+encodeURIComponent(ref)+'&order=revision.desc');
        const l=await supabaseRequest('acc_loa_issuance?select=revision,status&reference_no=eq.'+encodeURIComponent(ref)+'&limit=1');
        result={history:history||[],currentRevision:l?.[0]?.revision||null,currentStatus:l?.[0]?.status||null};
      }
      transport='ACC_LOA_REVISION';bridgeMs=0;
    }else if(action==='accLoaStatus'){`);
s=one(s,"const jobs=await supabaseRequest('acc_loa_jobs?select=reference_no,status,updated_at&order=updated_at.desc&limit=4000');","const revisionEnabled=accRevisionEnabled();\n      const jobs=await supabaseRequest('acc_loa_jobs?select=reference_no,status,updated_at'+(revisionEnabled?',kind,revision':'')+'&order=updated_at.desc&limit=4000');");
s=one(s,"const ledger=await supabaseRequest('acc_loa_issuance?select=reference_no,status,updated_at,sent_at,pdf_files&order=updated_at.desc&limit=4000');","const ledger=await supabaseRequest('acc_loa_issuance?select=reference_no,status,updated_at,sent_at,pdf_files'+(revisionEnabled?',revision':'')+'&order=updated_at.desc&limit=4000');\n      const drafts=revisionEnabled?await supabaseRequest('acc_loa_revision_requests?select=reference_no,revision,state,plan&state=eq.DRAFT&limit=4000'):[];");
s=one(s,"result={jobs,ledger:ledger.map(x=>({reference_no:x.reference_no,status:x.status,updated_at:x.updated_at,sent_at:x.sent_at,pdf_url:x.status==='SENT'?x.pdf_files?.[0]?.url||'':''}))};","result={jobs,revisionEnabled,drafts:(drafts||[]).map(d=>({reference_no:d.reference_no,revision:d.revision,studyMode:d.plan.nextStudyMode,state:d.state})),ledger:ledger.map(x=>({reference_no:x.reference_no,status:x.status,revision:x.revision||1,updated_at:x.updated_at,sent_at:x.sent_at,pdf_url:x.status==='SENT'?x.pdf_files?.[0]?.url||'':''}))};");
return s;});
edit('admin.html',s=>{
s=one(s,"const accLoaJobs=new Map(),accLoaLedger=new Map();let accLoaPollBusy=false;","const accLoaJobs=new Map(),accLoaLedger=new Map(),accRevisionDrafts=new Map();let accLoaPollBusy=false,accRevisionReady=false;");
s=one(s,"function logout(){accLoaJobs.clear();accLoaLedger.clear();","function logout(){accLoaJobs.clear();accLoaLedger.clear();accRevisionDrafts.clear();accRevisionReady=false;");
s=one(s,"old=JSON.stringify([...accLoaJobs,...accLoaLedger]);","old=JSON.stringify([...accLoaJobs,...accLoaLedger,...accRevisionDrafts,accRevisionReady]);");
s=one(s,"accLoaJobs.clear();accLoaLedger.clear();for(const j of out.result.jobs||[])","accLoaJobs.clear();accLoaLedger.clear();accRevisionDrafts.clear();accRevisionReady=out.result.revisionEnabled===true;for(const d of out.result.drafts||[])accRevisionDrafts.set(d.reference_no,d);for(const j of out.result.jobs||[])");
s=one(s,"if(old!==JSON.stringify([...accLoaJobs,...accLoaLedger]))","if(old!==JSON.stringify([...accLoaJobs,...accLoaLedger,...accRevisionDrafts,accRevisionReady]))");
s=one(s,"function accLoaLabel(r){const st=accLoaJobState(r);return (","function accLoaLabel(r){const st=accLoaJobState(r),j=accLoaJobs.get(r?.ref),l=accLoaLedger.get(r?.ref);if(st==='SENT'&&Number(l?.revision)>1)return 'Revised LOA Issued · R'+String(l.revision).padStart(2,'0');if(accRevisionDrafts.has(r?.ref)&&st==='SENT')return 'Revision Draft';if(j?.kind==='REVISE'&&st==='QUEUED')return 'Revision Queued';return (");
s=one(s,"function accAcceptanceBadge(r){const w=r.workflow||{}","function accAcceptanceBadge(r){if(accLoaJobs.get(r.ref)?.kind==='REVISE'&&accLoaBusy(r))return '<span class=\"badge amber\">Revision Processing</span>';const w=r.workflow||{}");
s=one(s,"}if(AI_SCREENING_UI_ENABLED){if(aiReport)","}if(accRevisionReady&&accLoaLedger.get(r.ref)?.status==='SENT'&&!accLoaBusy(r)&&accLoaJobState(r)!=='REVIEW_REQUIRED'&&accRevisionDrafts.has(r.ref))a.push('<button class=\"primary\" type=\"button\" onclick=\"queueAccLoaRevision()\">Reissue Revised LOA</button>');if(accRevisionReady&&Number(accLoaLedger.get(r.ref)?.revision||1)>1)a.push('<button class=\"ghost\" type=\"button\" onclick=\"openAccLoaHistory()\">LOA Version History</button>');if(AI_SCREENING_UI_ENABLED){if(aiReport)");
s=one(s,"if(String(r.workflow?.['Acceptance Status']||'').toUpperCase()!=='ACCEPTED'&&r.workflow?.['Acceptance Signing URL']","if(!accLoaBusy(r)&&accLoaJobState(r)!=='REVIEW_REQUIRED'&&String(r.workflow?.['Acceptance Status']||'').toUpperCase()!=='ACCEPTED'&&r.workflow?.['Acceptance Signing URL']");
s=one(s,"const mode=accModeValue(r.app['Study Mode']);const locked=accLoaPreviewMode()||db.ACC_APPLICATION_ADMIN_STATUS!=='READY'||accLoaAlreadyIssued(r)||accLoaBusy(r);","const draft=accRevisionDrafts.get(r.ref),mode=draft?.studyMode||accModeValue(r.app['Study Mode']);const locked=accLoaPreviewMode()||db.ACC_APPLICATION_ADMIN_STATUS!=='READY'||(accLoaAlreadyIssued(r)&&!(accRevisionReady&&accLoaLedger.get(r.ref)?.status==='SENT'))||accLoaBusy(r)||accLoaJobState(r)==='REVIEW_REQUIRED';");
s=one(s,"+picker+'</div>'+pair('Intake'","+picker+(draft?'<small style=\"display:block;color:#66529c;margin-top:5px\">Revision draft — current issued mode: '+esc(accModeValue(r.app['Study Mode']))+'</small>':'')+'</div>'+pair('Intake'");
s=one(s,"if(!selected||accLoaBusy(selected)||accLoaAlreadyIssued(selected)||accLoaPreviewMode())return;const ref=selected.ref,prior=","if(!selected||accLoaBusy(selected)||accLoaPreviewMode())return;const revised=accLoaAlreadyIssued(selected);if(revised&&(!accRevisionReady||accLoaLedger.get(selected.ref)?.status!=='SENT'))return;const ref=selected.ref,prior=");
s=one(s,"if(reason===null||!reason.trim())return;const btn=document.getElementById('accStudyModeSave')","if(reason===null||!reason.trim())return;let registryConfirmed=false;if(revised&&String(selected.workflow?.['Acceptance Status']||'').toUpperCase()==='ACCEPTED'){registryConfirmed=confirm('Registry confirmation required: preserve the existing signed acceptance as history and require fresh acceptance of the revised LOA. Confirm?');if(!registryConfirmed)return;}const btn=document.getElementById('accStudyModeSave')");
s=one(s,"action:'accSetStudyMode',data:{referenceNo:ref,studyMode:mode,expectedStudyMode:prior,reason:reason.trim()}","action:revised?'accSaveLoaRevision':'accSetStudyMode',data:{referenceNo:ref,studyMode:mode,expectedStudyMode:prior,reason:reason.trim(),registryConfirmed}");
s=one(s,"const a=(db.V2_APPLICATIONS||[]).find(x=>String(x['Reference No'])===ref);if(a){a['Study Mode']=mode;","if(revised){accRevisionDrafts.set(ref,{reference_no:ref,revision:out.result.revision,studyMode:mode,state:'DRAFT'});if(selected?.ref===ref){renderDetailTabs(selected);renderQuickActions(selected);opsMsg('Revision draft saved. Click Reissue Revised LOA to apply the change.','ok');}renderApplications();return;}const a=(db.V2_APPLICATIONS||[]).find(x=>String(x['Reference No'])===ref);if(a){a['Study Mode']=mode;");
s=one(s,"    function objectCard(title,obj,keys,full=false){",`
    async function queueAccLoaRevision(){if(!selected||!accRevisionReady||accLoaBusy(selected))return;const ref=selected.ref,d=accRevisionDrafts.get(ref);if(!d||!confirm('Reissue the official LOA as '+d.studyMode+' (Revision '+d.revision+')? The previous acceptance link will be revoked and a new link sent.'))return;accLoaJobs.set(ref,{reference_no:ref,status:'QUEUED',kind:'REVISE',revision:d.revision});renderQuickActions(selected);renderApplications();try{const r=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,action:'accQueueLoaRevision',data:{referenceNo:ref,revision:d.revision},updatedBy:'Admin Portal V2'})}),o=await r.json();if(!r.ok||!o.ok)throw Error(o.message||'Revision queue not confirmed');accRevisionDrafts.delete(ref);if(selected?.ref===ref)opsMsg('Revised LOA queued. You may continue working.','ok');}catch(e){if(selected?.ref===ref)opsMsg(e.message+' Check status before retrying.','error');}finally{await pollAccLoa();}}
    async function openAccLoaHistory(){if(!selected||!accRevisionReady)return;const ref=selected.ref;opsMsg('Loading LOA history...','info');try{const r=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,action:'accLoaHistory',data:{referenceNo:ref}})}),o=await r.json();if(!r.ok||!o.ok)throw Error(o.message||'History unavailable');if(selected?.ref!==ref)return;const d=document.createElement('dialog');d.style.cssText='max-width:640px;width:90%;border:1px solid #ddd;border-radius:18px;padding:24px;color:#24263b';const link=(u,label)=>/^https:\\/\\/drive\\.google\\.com\\/file\\/d\\/[-\\w]+\\/view(?:\\?.*)?$/.test(u||'')?'<a class="ghost" target="_blank" rel="noopener" href="'+esc(u)+'">'+esc(label)+'</a>':'';const entries=(o.result.history||[]).map(h=>'<section style="padding:12px 0;border-bottom:1px solid #eee"><strong>Revision '+esc(String(h.revision).padStart(2,'0'))+' · '+esc(h.study_mode)+'</strong><p>'+esc(o.result.currentStatus==='SENT'&&o.result.currentRevision>h.revision?'Superseded':'Archived — revision requires review')+' · '+esc(h.acceptance_status)+'</p><p>'+esc(h.reason||'')+'</p><div style="display:flex;gap:6px;flex-wrap:wrap">'+(h.pdf_files||[]).map((f,i)=>link(f.url,['Official LOA','Acceptance','Surat Penerimaan','Surat Akuan'][i]||'PDF')).join('')+(h.signed_document_urls||[]).map((u,i)=>link(u,'Signed document '+(i+1))).join('')+'</div></section>').join('');d.innerHTML='<h3>LOA Version History</h3>'+ (entries||'<p>No previous revisions.</p>')+'<p><button type="button" class="ghost">Close</button></p>';d.querySelector('button').onclick=()=>{d.close();d.remove();};document.body.appendChild(d);d.showModal();opsMsg('LOA version history loaded.','ok');}catch(e){if(selected?.ref===ref)opsMsg(e.message,'error');}}
    function objectCard(title,obj,keys,full=false){`);
return s;});
console.log('Revision draft, authenticated queue, worker and history UI staged.');
