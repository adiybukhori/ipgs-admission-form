const ADMIN_BRIDGE = String(process.env.N8N_ADMIN_BRIDGE_URL||'').trim();
const V2_WEB_APP = 'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';
const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';

const ALLOWED_ACTIONS = new Set([
  'v2ListWorkflow','v2UpsertFeeStructure','v2SetFeeStructureStatus','v2UpsertAgent','v2AgentAdminStatus','v2UpdateStage','v2RunDocumentReview','v2RegeneratePgAdm01','v2CompleteManualDocumentReview','v2RunQualificationScreening','v2RunAutoAiScreening','v2CompleteManualQualificationScreening','v2RecordAiScreeningResult','v2ConfirmAiScreening','v2GenerateAiScreeningReport','v2RunComplianceDocumentQuality','v2SendDocumentReplacementRequest','v2SendMissingDocumentRequest','v2PrepareSacCoordination','v2PrepareIaCoordination','v2PreparePrerequisiteCoordination','v2PrepareOrientationForAccepted','v2RunOrientationSessionSupervisor','v2PrepareSkyActivation','v2PrepareAcademicHandover','v2PrepareStudentAccessDelivery','v2RunManagementIntelligence','v2AgenticStatus','v2GetAgentCaseState','v2AgentActionGateway','v2RecordAgentActivity','v2CreateHumanTask','v2ResolveHumanTask','v2ListOpenHumanTasks',
  'v2IssueOffer','v2PrepareAcceptancePack','v2ResendAcceptanceConfirmation','v2CreateSacSession','v2AssignSacCandidate','v2RemoveSacCandidate','v2PrepareSacPack','v2PrepareSacPackAsync','v2GetSacPackPrepareStatus','v2GetSacPackFile','v2SaveSacPackPdf','v2ListSacCandidates','v2RecordSacDecision','v2CreateSacSessionManual','v2UpdateSacSessionManual','v2DeleteSacSessionManual','v2SendSacCalendarInvitationManual','v2RecordSacDecisionManual','v2FinalizeSacSessionManual','v2SacManualPhase1Status','v2SacResultStatus','v2PrepareSacResultDocument','v2PreviewSacResult','v2SendSacResultEmail','v2UpdateAssessment','v2CreateOrientationSession','v2AssignOrientationBatch','v2SendOrientationInvitation','v2RemoveOrientationStudent','v2MoveOrientationStudent','v2UpdateOrientationAttendance','v2SendOrientationReminderNow','v2EndOrientationSession','v2EditOrientationSession','v2OpenOrientationAttendance','v2CloseOrientationAttendance','v2SetOrientationRecording','v2SendOrientationRecording','v2OrientationCompletionAssessment','v2CompleteOrientationAndGenerateReport','v2RegenerateOrientationReport','v2GetOrientationReportFile','v2CreateHandoverSession','v2AddHandoverStudents','v2SendHandoverSession','v2CreateAcademicHandoverBatch','v2ResendAcademicHandoverEmail','v2UpdateProvisioningTask','v2ResendProvisioningTaskEmails','v2SendStudentProvisioningAccess','v2RegistryUpsertProspect','v2RefreshFeeStructure','v2NotifyRegistryProspectReady','v2ActivateStudentInSky','v2SetApplicationAgent','v2MoveApplicationToActivated','v2ConfirmSkyActivationInAcc'
]);

async function validateDirectAdmin(password){
  if(!password)return false;
  const local=String(process.env.V2_ADMIN_API_PASSWORD||'');
  if(local&&local===String(password))return true;
  try{
    const r=await fetch(`${AUTH_WEB_APP}?action=applications&token=${encodeURIComponent(String(password))}&_=${Date.now()}`,{redirect:'follow'});
    const t=await r.text();const j=JSON.parse(t);return r.ok&&j?.ok===true;
  }catch(_){return false;}
}
async function callAppsScriptV2(action,data,password,updatedBy){
  const token=String(process.env.V2_ADMIN_API_PASSWORD||password||'');
  const startedAt=Date.now();
  const r=await fetch(V2_WEB_APP,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token,data:data||{},updatedBy:updatedBy||'Admin Portal V2'}),redirect:'follow'});
  const text=await r.text();let parsed;try{parsed=JSON.parse(text)}catch(_){throw new Error(`Apps Script SAC backend returned HTTP ${r.status}.`)}
  if(!r.ok||!parsed||parsed.ok===false)throw new Error(parsed?.message||`Apps Script SAC backend returned HTTP ${r.status}.`);
  return {parsed,bridgeMs:Date.now()-startedAt};
}


const ACC_SPREADSHEET_ID='1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
function accParseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){if(quoted&&next==='"'){field+='"';i++;}else quoted=!quoted;continue}
    if(ch===','&&!quoted){row.push(field);field='';continue}
    if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(field);if(row.some(v=>String(v||'').trim()!==''))rows.push(row);row=[];field='';continue}
    field+=ch;
  }
  row.push(field);if(row.some(v=>String(v||'').trim()!==''))rows.push(row);
  if(!rows.length)return[];
  const headers=rows[0].map(x=>String(x||'').trim());
  return rows.slice(1).map(line=>Object.fromEntries(headers.map((h,i)=>[h,line[i]||''])));
}
async function accVerifiedSheetRows(sheet){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const url='https://docs.google.com/spreadsheets/d/'+ACC_SPREADSHEET_ID+'/gviz/tq?tqx=out:csv&sheet='+encodeURIComponent(sheet)+'&_='+Date.now();
    const r=await fetch(url,{signal:controller.signal,redirect:'follow'});
    if(!r.ok)throw new Error('Could not verify '+sheet+' (HTTP '+r.status+').');
    const csv=await r.text(),rows=accParseCsv(csv);
    if(sheet==='AGENT_MASTER'?!csv.includes('Agent Code'):(!csv.includes('Reference No')&&!csv.includes('Reference')))throw new Error('Unexpected '+sheet+' data. Please refresh and retry.');
    return rows;
  }finally{clearTimeout(timer)}
}
async function accApplyAdminAction(action,data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e}
  if(!supabaseConfig())throw new Error('ACC Supabase is not configured.');
  const referenceNo=String(data?.referenceNo||'').trim();
  if(!/^IUC-ADM-/i.test(referenceNo)||referenceNo.length>160)throw new Error('Valid V2 application reference is required.');
  const actor=String(updatedBy||'Registry Admin Portal V2').slice(0,160);
  if(action==='v2ConfirmSkyActivationInAcc'){
    // Registry confirms an activation already completed in external SkyVialing.
    // This action does NOT activate SkyVialing itself, complete acceptance or change SAC.
    const apps=await accVerifiedSheetRows('V2_APPLICATIONS');
    if(!apps.some(row=>String(row['Reference No']||row.Reference||'').trim()===referenceNo))
      throw new Error('Application not found. Please refresh.');
    const skyStudentId=String(data?.skyStudentId||'').trim();
    const remarks=String(data?.remarks||'').trim();
    if(skyStudentId.length>120||remarks.length>1500)throw new Error('SKY Student ID or remarks too long.');
    const applied=await supabaseRequest('rpc/acc_confirm_sky_activation','POST',{
      p_reference_no:referenceNo,p_actor:actor,
      p_sky_student_id:skyStudentId||null,p_remarks:remarks||null
    });
    if(!applied||applied.sky_activation_status!=='ACTIVATED'||applied.reference_no!==referenceNo)
      throw new Error('Unable to persist SKY activation confirmation.');
    return {ok:true,...applied};
  }
  if(action==='v2MoveApplicationToActivated'){
    // Early activation can be verified directly by Registry in ACC even when
    // the legacy Prospect/Fee Structure workflow is incomplete.
    const localRows=await supabaseRequest('acc_application_admin?select=sky_activation_status&reference_no=eq.'+encodeURIComponent(referenceNo)+'&limit=1');
    const locallyConfirmed=Array.isArray(localRows)&&localRows.some(row=>String(row.sky_activation_status||'').toUpperCase()==='ACTIVATED');
    if(!locallyConfirmed){
      const rows=await accVerifiedSheetRows('V2_WORKFLOW');
      const w=rows.filter(row=>String(row['Reference No']||row.Reference||'').trim()===referenceNo).slice(-1)[0];
      if(!w||String(w['SKY Activation Status']||'').trim().toUpperCase()!=='ACTIVATED')
        throw new Error('Student must first be confirmed as Activated in SkyVialing.');
    }
    const applied=await supabaseRequest('rpc/acc_apply_application_admin_change','POST',{
      p_reference_no:referenceNo,p_action:'MOVE_TO_ACTIVATED',p_actor:actor,
      p_agent_code:null,p_agent_name:null
    });
    if(!applied||applied.moved_to_activated!==true)throw new Error('Could not persist move to Activated.');
    return {ok:true,...applied};
  }
  if(action==='v2SetApplicationAgent'){
    const apps=await accVerifiedSheetRows('V2_APPLICATIONS');
    if(!apps.some(row=>String(row['Reference No']||row.Reference||'').trim()===referenceNo))throw new Error('Application not found.');
    const code=String(data?.agentCode||'').trim();
    if(!code||code.length>80)throw new Error('Please select an agent / student category.');
    let name='Direct / Registry';
    if(code!=='DIRECT'){
      const agents=await accVerifiedSheetRows('AGENT_MASTER');
      const agent=agents.find(row=>String(row['Agent Code']||'').trim()===code);
      if(!agent)throw new Error('Agent code not found in ACC Agent Master.');
      name=String(agent['Agent Name']||'').trim();
      if(!name)throw new Error('Agent name is missing in Agent Master.');
    }
    const applied=await supabaseRequest('rpc/acc_apply_application_admin_change','POST',{
      p_reference_no:referenceNo,p_action:'SET_AGENT',p_actor:actor,
      p_agent_code:code,p_agent_name:name
    });
    if(!applied||applied.reference_no!==referenceNo)throw new Error('Could not persist student category.');
    return {ok:true,...applied};
  }
  throw new Error('Unsupported ACC application action.');
}

async function recordInternalRemarkDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const ref=String(data?.referenceNo||'').trim();
  const eventType=String(data?.action||data?.activity||data?.type||'').toUpperCase();
  if(!ref)throw new Error('Reference No is required.');
  if(eventType!=='INTERNAL_REMARK')throw new Error('Direct activity write is limited to INTERNAL_REMARK.');
  const remark=String(data?.remark||data?.note||data?.message||data?.details||data?.summary||data?.data?.remark||'').trim();
  if(!remark)throw new Error('Remark is required.');
  const payload={
    remark,
    summary:String(data?.summary||remark),
    note:String(data?.note||remark),
    message:String(data?.message||remark),
    details:String(data?.details||remark),
    status:String(data?.status||'RECORDED'),
    caseTag:String(data?.['Case Tag']||data?.caseTag||data?.data?.caseTag||''),
    agentId:String(data?.agentId||'ADMIN_PORTAL'),
    executionId:String(data?.executionId||'')
  };
  const rows=await supabaseRequest('workflow_events','POST',[{
    reference_no:ref,event_type:'INTERNAL_REMARK',actor:updatedBy||'Admin Portal V2',
    source:'ADMIN_PORTAL_V2',payload
  }]);
  return {ok:true,referenceNo:ref,eventType:'INTERNAL_REMARK',remark,row:Array.isArray(rows)?rows[0]||null:null};
}
async function removeSacCandidateDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const legacy=String(data?.sessionId||data?.sacSessionId||'');
  const ref=String(data?.referenceNo||'');
  if(!legacy||!ref)throw new Error('SAC session and Reference No are required.');
  const session=await findSacSession(legacy);
  if(!session)throw new Error('SAC session not found in Supabase.');
  const removed=await supabaseRequest(`sac_candidates?sac_session_id=eq.${encodeURIComponent(session.id)}&reference_no=eq.${encodeURIComponent(ref)}`,'DELETE');
  await supabaseRequest('workflow_events','POST',[{reference_no:ref,event_type:'SAC_CANDIDATE_REMOVED',actor:updatedBy||'Admin Portal V2',source:'ADMIN_PORTAL_V2',payload:{sac_session_id:legacy}}]);
  return {ok:true,removed:Array.isArray(removed)?removed:[],referenceNo:ref,sessionId:legacy};
}




async function assignSacCandidateDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const legacy=String(data?.sessionId||data?.sacSessionId||'').trim();
  const ref=String(data?.referenceNo||'').trim();
  if(!legacy||!ref)throw new Error('SAC session and Reference No are required.');
  const session=await findSacSession(legacy);if(!session)throw new Error('SAC session not found in Supabase.');
  const existing=await supabaseRequest(`sac_candidates?select=id,sac_session_id&reference_no=eq.${encodeURIComponent(ref)}&limit=1`);
  if(Array.isArray(existing)&&existing.length){
    if(String(existing[0].sac_session_id)===String(session.id))return {ok:true,alreadyAssigned:true,referenceNo:ref,sessionId:legacy};
    throw new Error('This applicant is already assigned to another SAC session. Remove the applicant from that session first.');
  }
  const now=new Date().toISOString();
  const rows=await supabaseRequest('sac_candidates','POST',[{
    sac_session_id:session.id,reference_no:ref,
    student_name:String(data?.studentName||'').trim()||null,
    programme:String(data?.programme||'').trim()||null,
    screening_recommendation:String(data?.screeningRecommendation||'').trim()||null,
    decision:'PENDING',priority:'NORMAL',reviewer_remarks:String(data?.overrideBy||'').trim()||null,
    created_at:now,updated_at:now
  }]);
  await supabaseRequest('workflow_events','POST',[{reference_no:ref,event_type:'SAC_CANDIDATE_ASSIGNED',actor:updatedBy||'Admin Portal V2',source:'ADMIN_PORTAL_V2',payload:{sac_session_id:legacy}}]);
  return {ok:true,referenceNo:ref,sessionId:legacy,candidate:{'SAC Session ID':legacy,'Reference No':ref,'Student Name':String(data?.studentName||''),'Programme':String(data?.programme||''),'Decision':'PENDING'}};
}

async function updateSacSessionDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const legacy=String(data?.sessionId||data?.sacSessionId||'').trim();if(!legacy)throw new Error('SAC session is required.');
  const patch={updated_at:new Date().toISOString()};
  if(data?.name!==undefined)patch.sac_name=String(data.name||'').trim();
  if(data?.meetingDate!==undefined)patch.meeting_date=String(data.meetingDate||'').trim()||null;
  if(data?.meetingTime!==undefined)patch.meeting_time=String(data.meetingTime||'').trim()||null;
  if(data?.chairperson!==undefined)patch.chairperson=String(data.chairperson||'').trim()||null;
  if(data?.venueLink!==undefined)patch.venue=String(data.venueLink||'').trim()||null;
  if(data?.committeeEmails!==undefined)patch.committee_emails=String(data.committeeEmails||'').split(',').map(x=>x.trim()).filter(Boolean);
  const rows=await supabaseRequest(`sac_sessions?legacy_session_id=eq.${encodeURIComponent(legacy)}`,'PATCH',patch);
  if(!Array.isArray(rows)||!rows.length)throw new Error('SAC session not found in Supabase.');
  return {ok:true,sessionId:legacy};
}

async function createSacSessionDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const name=String(data?.name||data?.sacName||'').trim();
  const meetingDate=String(data?.meetingDate||'').trim();
  const meetingTime=String(data?.meetingTime||'10:00').trim();
  const chairperson=String(data?.chairperson||'').trim();
  const venue=String(data?.venueLink||data?.venue||'').trim();
  const committeeEmails=String(data?.committeeEmails||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!name||!meetingDate)throw new Error('SAC Name and Meeting Date are required.');
  const compact=meetingDate.replace(/-/g,'');
  const rand=Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const legacy=`SAC-${compact}-${rand}`;
  const now=new Date().toISOString();
  const rows=await supabaseRequest('sac_sessions','POST',[{
    legacy_session_id:legacy,sac_name:name,meeting_date:meetingDate,meeting_time:meetingTime,
    status:'DRAFT',chairperson:chairperson||null,venue:venue||null,meeting_mode:'MANUAL',
    committee_emails:committeeEmails.length?committeeEmails:null,calendar_status:'NOT_CREATED',
    invitation_mode:'DISABLED',created_by:updatedBy||'Admin Portal V2',created_at:now,updated_at:now
  }]);
  const row=Array.isArray(rows)?rows[0]:null;
  return {ok:true,sessionId:legacy,session:{'SAC Session ID':legacy,'SAC Name':name,'Meeting Date':meetingDate,'Meeting Time':meetingTime,'Status':'DRAFT','Chairperson':chairperson,'Venue / Meeting Link':venue,'Meeting Mode':'MANUAL','Committee Emails':committeeEmails.join(', '),'Calendar Status':'NOT_CREATED','Invitation Mode':'DISABLED','Created At':now,'Created By':updatedBy||'Admin Portal V2'},invitation:{sent:false,reason:'DISABLED',mode:'DISABLED'}};
}

async function deleteSacSessionDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const legacy=String(data?.sessionId||data?.sacSessionId||'');
  if(!legacy)throw new Error('SAC session is required.');
  const session=await findSacSession(legacy);
  if(!session)throw new Error('SAC session not found in Supabase.');
  const members=await supabaseRequest(`sac_candidates?select=id&method=eq.ignore&sac_session_id=eq.${encodeURIComponent(session.id)}`.replace('&method=eq.ignore',''));
  if(Array.isArray(members)&&members.length)throw new Error('Remove all SAC participants before deleting this session.');
  const removed=await supabaseRequest(`sac_sessions?id=eq.${encodeURIComponent(session.id)}`,'DELETE');
  return {ok:true,sessionId:legacy,removed:Array.isArray(removed)?removed:[]};
}

async function supabaseRpc(fn,body){
 const cfg=supabaseConfig();if(!cfg)throw new Error('Supabase is not configured.');
 const r=await fetch(`${cfg.url}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},body:JSON.stringify(body||{})});
 const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(_){}if(!r.ok)throw new Error(j?.message||`Supabase workflow RPC returned HTTP ${r.status}.`);return j;
}
async function verifyWorkflowState(referenceNo,expectedStage,expectedAssessment,expectedPrerequisite){
 const rows=await supabaseRequest(`workflow_state?select=current_stage,assessment_status,prerequisite_status,workflow_version&reference_no=eq.${encodeURIComponent(referenceNo)}&limit=1`);
 const row=Array.isArray(rows)?rows[0]:null;if(!row)return {ok:false,row:null};
 const ok=String(row.current_stage||'')===String(expectedStage||'')&&(!expectedAssessment||String(row.assessment_status||'')===String(expectedAssessment))&&(!expectedPrerequisite||String(row.prerequisite_status||'')===String(expectedPrerequisite));
 return {ok,row};
}
async function recordSacDecisionDirect(data,password,updatedBy){
 if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
 const legacy=String(data?.sessionId||data?.sacSessionId||'').trim(),ref=String(data?.referenceNo||'').trim(),decision=String(data?.decision||'').toUpperCase();
 if(!legacy||!ref||!decision)throw new Error('SAC session, Reference No and decision are required.');
 const expectedStage=decision==='DIRECT_ENTRY'?'ELIGIBLE_FOR_OFFER':decision==='INTERNAL_ASSESSMENT'?'INTERNAL_ASSESSMENT':decision==='REJECTED'?'REJECTED':'';
 const expectedAssessment=decision==='INTERNAL_ASSESSMENT'?'PENDING':'NOT_REQUIRED',expectedPrerequisite='NOT_REQUIRED';
 let r=null,verified=null;
 for(let attempt=1;attempt<=3;attempt++){
  r=await supabaseRpc('record_sac_decision_atomic',{p_legacy_session_id:legacy,p_reference_no:ref,p_decision:decision,p_actor:updatedBy||'Admin Portal V2',p_remarks:String(data?.remarks||'')});
  verified=await verifyWorkflowState(ref,expectedStage,expectedAssessment,expectedPrerequisite);if(verified.ok)break;
 }
 if(!verified?.ok)throw new Error('SAC decision was saved but workflow verification failed after 3 attempts. No downstream action was released.');
 return {...(r||{}),verified:true,workflowVersion:verified.row?.workflow_version||r?.workflowVersion,workflowSyncStatus:'SUPABASE_CANONICAL',canonicalWorkflowEngine:'SUPABASE',legacyWorkflowSyncStatus:r?.legacySyncStatus||'PENDING'};
}
async function recordAssessmentResultDirect(data,password,updatedBy){
 if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
 const ref=String(data?.referenceNo||'').trim(),typ=String(data?.assessmentType||'').toUpperCase(),res=String(data?.panelResult||'').toUpperCase();
 if(!ref||!typ||!res)throw new Error('Reference No, assessment type and panel result are required.');
 let expectedStage='',expectedAssessment='',expectedPrerequisite='';
 if(typ==='INTERNAL_ASSESSMENT'){
  if(res==='QUALIFIED'){expectedStage='ELIGIBLE_FOR_OFFER';expectedAssessment='QUALIFIED';expectedPrerequisite='NOT_REQUIRED';}
  else if(res==='PREREQUISITE_REQUIRED'){expectedStage='PREREQUISITE';expectedAssessment='PREREQUISITE_REQUIRED';expectedPrerequisite='PENDING';}
  else if(res==='NOT_QUALIFIED'){expectedStage='REJECTED';expectedAssessment='NOT_QUALIFIED';expectedPrerequisite='NOT_REQUIRED';}
 }else if(typ==='PREREQUISITE'){
  expectedStage=res==='QUALIFIED'?'ELIGIBLE_FOR_OFFER':res==='NOT_QUALIFIED'?'REJECTED':'';expectedPrerequisite=res;
 }
 let r=null,verified=null;
 for(let attempt=1;attempt<=3;attempt++){
  r=await supabaseRpc('record_assessment_result_atomic',{p_reference_no:ref,p_assessment_type:typ,p_panel_result:res,p_actor:updatedBy||'Admin Portal V2',p_remarks:String(data?.remarks||'')});
  verified=await verifyWorkflowState(ref,expectedStage,expectedAssessment,expectedPrerequisite);if(verified.ok)break;
 }
 if(!verified?.ok)throw new Error('Assessment result was saved but workflow verification failed after 3 attempts. No downstream action was released.');
 return {...(r||{}),verified:true,workflowVersion:verified.row?.workflow_version||r?.workflowVersion,workflowSyncStatus:'SUPABASE_CANONICAL',canonicalWorkflowEngine:'SUPABASE',legacyWorkflowSyncStatus:r?.legacySyncStatus||'PENDING'};
}

async function callV2(action, data, password, sessionId, updatedBy) {
  const startedAt = Date.now();
  let bridgeError = null;

  if (ADMIN_BRIDGE) {
    try {
      const response = await fetch(ADMIN_BRIDGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({password:String(password||''),sessionId:String(sessionId||''),action,data:data||{},updatedBy:updatedBy||'Admin Portal V2'}),
        redirect: 'follow'
      });
      const text = await response.text();
      let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch (_) {}
      if (response.ok && parsed && parsed.ok !== false) return { parsed, bridgeMs: Date.now() - startedAt, transport:'N8N_BRIDGE' };
      bridgeError = new Error(parsed?.message || `Admin bridge returned HTTP ${response.status}.`);
      bridgeError.status = response.status;
    } catch (error) { bridgeError = error; }
  }

  try {
    const direct = await callAppsScriptV2(action, data, password, updatedBy);
    return {
      parsed: direct.parsed,
      bridgeMs: Date.now() - startedAt,
      transport: ADMIN_BRIDGE ? 'APPS_SCRIPT_FALLBACK' : 'APPS_SCRIPT_DIRECT',
      bridgeWarning: ADMIN_BRIDGE ? String(bridgeError?.message||'n8n bridge unavailable') : null
    };
  } catch (directError) {
    const bridgePart = ADMIN_BRIDGE ? `Bridge: ${String(bridgeError?.message||'unavailable')} | ` : '';
    const error = new Error(`Workflow command failed. ${bridgePart}V2 backend: ${String(directError?.message||'failed')}`);
    error.code = /password|auth/i.test(String(directError?.message||'')) ? 'ADMIN_AUTH_FAILED' : 'V2_ACTION_FAILED';
    throw error;
  }
}


function supabaseConfig(){const url=String(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'');return url&&key?{url,key}:null;}
async function supabaseRequest(path,method='GET',body){const cfg=supabaseConfig();if(!cfg)return null;const r=await fetch(`${cfg.url}/rest/v1/${path}`,{method,headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();let p=null;try{p=t?JSON.parse(t):null}catch(_){}if(!r.ok)throw new Error(p?.message||`Supabase mirror HTTP ${r.status}`);return p;}
async function findSacSession(legacyId){const rows=await supabaseRequest(`sac_sessions?select=id,legacy_session_id&legacy_session_id=eq.${encodeURIComponent(String(legacyId||''))}&limit=1`);return Array.isArray(rows)?rows[0]:null;}
async function mirrorSacAction(action,data,result,updatedBy){
  if(!supabaseConfig())return;
  const payload=result?.result||result||{};
  if(action==='v2CreateSacSession'||action==='v2CreateSacSessionManual'){
    const row=payload.session||payload.sacSession||data||{};const legacy=row['SAC Session ID']||row.sessionId||row.sacSessionId||data?.sessionId||'';if(!legacy)return;
    await supabaseRequest('sac_sessions?on_conflict=legacy_session_id','POST',[{legacy_session_id:legacy,sac_name:row['SAC Name']||row.sacName||data?.sacName||`SAC ${legacy}`,meeting_date:row['Meeting Date']||row.meetingDate||data?.meetingDate||null,meeting_time:row['Meeting Time']||row.meetingTime||data?.meetingTime||null,status:row.Status||row.status||'DRAFT',chairperson:row.Chairperson||row.chairperson||data?.chairperson||null,venue:row['Venue / Meeting Link']||row.venue||data?.venue||null,meeting_mode:row['Meeting Mode']||row.meetingMode||data?.meetingMode||null,created_by:updatedBy||'Admin Portal V2',updated_at:new Date().toISOString()}]);return;
  }
  if(action==='v2AssignSacCandidate'){
    const candidate=payload.candidate||{};const legacy=candidate['SAC Session ID']||candidate.sessionId||data?.sessionId||'';const ref=candidate['Reference No']||candidate.referenceNo||data?.referenceNo||'';if(!legacy||!ref)return;const session=await findSacSession(legacy);if(!session)return;
    await supabaseRequest('sac_candidates?on_conflict=sac_session_id,reference_no','POST',[{sac_session_id:session.id,reference_no:ref,student_name:candidate['Student Name']||candidate.studentName||null,programme:candidate.Programme||candidate.programme||null,screening_recommendation:candidate['Screening Recommendation']||candidate.screeningRecommendation||null,decision:candidate.Decision||candidate.decision||'PENDING',priority:candidate.Priority||candidate.priority||'NORMAL',reviewer_remarks:candidate['Reviewer Remarks']||candidate.reviewerRemarks||null,form_01_url:candidate['Form 01 URL']||candidate.form01Url||null,transcript_url:candidate['Transcript URL']||candidate.transcriptUrl||null,certificate_url:candidate['Certificate URL']||candidate.certificateUrl||null,updated_at:new Date().toISOString()}]);return;
  }
  if(action==='v2RecordSacDecision'||action==='v2RecordSacDecisionManual'){
    const legacy=data?.sessionId||data?.sacSessionId||payload?.candidate?.['SAC Session ID']||'';const ref=data?.referenceNo||payload?.candidate?.['Reference No']||'';const decision=data?.decision||payload?.candidate?.Decision||payload?.decision||'';if(!ref||!decision)return;
    let path=`sac_candidates?reference_no=eq.${encodeURIComponent(ref)}`;if(legacy){const session=await findSacSession(legacy);if(session)path+=`&sac_session_id=eq.${encodeURIComponent(session.id)}`;}
    await supabaseRequest(path,'PATCH',{decision,reviewer_remarks:data?.remarks||data?.reviewerRemarks||null,decision_by:updatedBy||'Admin Portal V2',decision_at:new Date().toISOString(),updated_at:new Date().toISOString()});return;
  }
  if(action==='v2UpdateSacSessionManual'){
    const legacy=data?.sessionId||data?.sacSessionId||'';if(!legacy)return;await supabaseRequest(`sac_sessions?legacy_session_id=eq.${encodeURIComponent(legacy)}`,'PATCH',{sac_name:data?.sacName||undefined,meeting_date:data?.meetingDate||undefined,meeting_time:data?.meetingTime||undefined,chairperson:data?.chairperson||undefined,venue:data?.venue||undefined,meeting_mode:data?.meetingMode||undefined,updated_at:new Date().toISOString()});return;
  }
  if(action==='v2DeleteSacSessionManual'){
    const legacy=data?.sessionId||data?.sacSessionId||'';if(legacy)await supabaseRequest(`sac_sessions?legacy_session_id=eq.${encodeURIComponent(legacy)}`,'DELETE');return;
  }
  if(action==='v2FinalizeSacSessionManual'){
    const legacy=data?.sessionId||data?.sacSessionId||'';if(legacy)await supabaseRequest(`sac_sessions?legacy_session_id=eq.${encodeURIComponent(legacy)}`,'PATCH',{status:'FINALISED',finalised_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed.' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const action = String(body.action || '');
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ ok: false, message: 'Unsupported or unapproved Admin V2 action.' });
  }

  const password = String(body.password || '');
  if (!password) return res.status(401).json({ ok: false, message: 'Admin password is required.' });

  const startedAt = Date.now();
  try {
    let result,bridgeMs,transport,bridgeWarning;
    if(action==='v2SetApplicationAgent'||action==='v2MoveApplicationToActivated'||action==='v2ConfirmSkyActivationInAcc'){
      const directStarted=Date.now();result=await accApplyAdminAction(action,body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_ACC_APPLICATION_ADMIN';bridgeWarning=null;
    }else if(action==='v2CreateSacSessionManual'){
      const directStarted=Date.now();result=await createSacSessionDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_SAC_ADMIN';bridgeWarning=null;
    }else if(action==='v2AssignSacCandidate'){
      const directStarted=Date.now();result=await assignSacCandidateDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_SAC_ADMIN';bridgeWarning=null;
    }else if(action==='v2RemoveSacCandidate'){
      const directStarted=Date.now();result=await removeSacCandidateDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_SAC_ADMIN';bridgeWarning=null;
    }else if(action==='v2UpdateSacSessionManual'){
      const directStarted=Date.now();result=await updateSacSessionDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_SAC_ADMIN';bridgeWarning=null;
    }else if(action==='v2DeleteSacSessionManual'){
      const directStarted=Date.now();result=await deleteSacSessionDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_SAC_ADMIN';bridgeWarning=null;
    }else if(action==='v2RecordSacDecisionManual'||action==='v2RecordSacDecision'){
      const directStarted=Date.now();result=await recordSacDecisionDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_WORKFLOW_ATOMIC';bridgeWarning=null;
    }else if(action==='v2UpdateAssessment'){
      const directStarted=Date.now();result=await recordAssessmentResultDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_WORKFLOW_ATOMIC';bridgeWarning=null;
    }else if(action==='v2RecordAgentActivity'&&String(body.data?.action||body.data?.activity||body.data?.type||'').toUpperCase()==='INTERNAL_REMARK'){
      const directStarted=Date.now();result=await recordInternalRemarkDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;transport='SUPABASE_INTERNAL_REMARK';bridgeWarning=null;
    }else{
      ({parsed:result,bridgeMs,transport,bridgeWarning}=await callV2(action, body.data || {}, password, body.sessionId, body.updatedBy));
    }
    let supabaseMirror='not_applicable';
    if(action.toLowerCase().includes('sac')){try{await mirrorSacAction(action,body.data||{},result,body.updatedBy);supabaseMirror='ok';}catch(mirrorError){supabaseMirror='warning:'+String(mirrorError?.message||'mirror failed');}}
    const totalMs = Date.now() - startedAt;
    res.setHeader('Server-Timing', `bridge;dur=${bridgeMs}, total;dur=${totalMs}`);
    return res.status(200).json({ ok: true, action, result, supabaseMirror, transport:transport||'UNKNOWN', bridgeWarning:bridgeWarning||null, performance: { bridgeMs, totalMs } });
  } catch (error) {
    return res.status(error?.code === 'ADMIN_AUTH_FAILED' ? 401 : 502).json({
      ok: false,
      code: error?.code || 'V2_ACTION_FAILED',
      message: error?.message || 'Unable to complete the Admin V2 action.'
    });
  }
}
