const ADMIN_BRIDGE = 'https://anasbukhori.app.n8n.cloud/webhook/iuc-admission-v2-admin-bridge';
const V2_WEB_APP = 'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';
const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';

const ALLOWED_ACTIONS = new Set([
  'v2ListWorkflow','v2UpsertFeeStructure','v2SetFeeStructureStatus','v2UpsertAgent','v2AgentAdminStatus','v2UpdateStage','v2RunDocumentReview','v2RegeneratePgAdm01','v2CompleteManualDocumentReview','v2RunQualificationScreening','v2RunAutoAiScreening','v2CompleteManualQualificationScreening','v2RecordAiScreeningResult','v2ConfirmAiScreening','v2GenerateAiScreeningReport','v2RunComplianceDocumentQuality','v2SendDocumentReplacementRequest','v2SendMissingDocumentRequest','v2PrepareSacCoordination','v2PrepareIaCoordination','v2PreparePrerequisiteCoordination','v2PrepareOrientationForAccepted','v2RunOrientationSessionSupervisor','v2PrepareSkyActivation','v2PrepareAcademicHandover','v2PrepareStudentAccessDelivery','v2RunManagementIntelligence','v2AgenticStatus','v2GetAgentCaseState','v2AgentActionGateway','v2RecordAgentActivity','v2CreateHumanTask','v2ResolveHumanTask','v2ListOpenHumanTasks',
  'v2IssueOffer','v2PrepareAcceptancePack','v2ResendAcceptanceConfirmation','v2CreateSacSession','v2AssignSacCandidate','v2RemoveSacCandidate','v2PrepareSacPack','v2PrepareSacPackAsync','v2GetSacPackPrepareStatus','v2GetSacPackFile','v2SaveSacPackPdf','v2ListSacCandidates','v2RecordSacDecision','v2CreateSacSessionManual','v2UpdateSacSessionManual','v2DeleteSacSessionManual','v2SendSacCalendarInvitationManual','v2RecordSacDecisionManual','v2FinalizeSacSessionManual','v2SacManualPhase1Status','v2SacResultStatus','v2PrepareSacResultDocument','v2PreviewSacResult','v2SendSacResultEmail','v2UpdateAssessment','v2CreateOrientationSession','v2AssignOrientationBatch','v2SendOrientationInvitation','v2RemoveOrientationStudent','v2MoveOrientationStudent','v2UpdateOrientationAttendance','v2SendOrientationReminderNow','v2EndOrientationSession','v2EditOrientationSession','v2OpenOrientationAttendance','v2CloseOrientationAttendance','v2SetOrientationRecording','v2SendOrientationRecording','v2OrientationCompletionAssessment','v2CompleteOrientationAndGenerateReport','v2RegenerateOrientationReport','v2GetOrientationReportFile','v2CreateHandoverSession','v2AddHandoverStudents','v2SendHandoverSession','v2CreateAcademicHandoverBatch','v2ResendAcademicHandoverEmail','v2UpdateProvisioningTask','v2ResendProvisioningTaskEmails','v2SendStudentProvisioningAccess','v2RegistryUpsertProspect','v2RefreshFeeStructure','v2NotifyRegistryProspectReady','v2ActivateStudentInSky'
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
async function removeSacCandidateDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const legacy=String(data?.sessionId||data?.sacSessionId||'');
  const ref=String(data?.referenceNo||'');
  if(!legacy||!ref)throw new Error('SAC session and Reference No are required.');
  const session=await findSacSession(legacy);
  if(!session)throw new Error('SAC session not found in Supabase.');
  const removed=await supabaseRequest(`sac_candidates?sac_session_id=eq.${encodeURIComponent(session.id)}&reference_no=eq.${encodeURIComponent(ref)}`,'DELETE');
  await supabaseRequest('workflow_events','POST',[{reference_no:ref,event_type:'SAC_CANDIDATE_REMOVED',from_stage:'SAC_REVIEW',to_stage:'READY_FOR_SAC',actor:updatedBy||'Admin Portal V2',source:'ADMIN_PORTAL_V2',payload:{sac_session_id:legacy}}]);
  return {ok:true,removed:Array.isArray(removed)?removed:[],referenceNo:ref,sessionId:legacy};
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

async function recordSacDecisionDirect(data,password,updatedBy){
  if(!(await validateDirectAdmin(password))){const e=new Error('Invalid admin password.');e.code='ADMIN_AUTH_FAILED';throw e;}
  const legacy=String(data?.sessionId||data?.sacSessionId||'');
  const ref=String(data?.referenceNo||'');
  const decision=String(data?.decision||'').toUpperCase();
  if(!legacy||!ref||!decision)throw new Error('SAC session, Reference No and decision are required.');
  if(!['DIRECT_ENTRY','INTERNAL_ASSESSMENT','REJECTED'].includes(decision))throw new Error('Unsupported SAC decision.');
  const session=await findSacSession(legacy);if(!session)throw new Error('SAC session not found in Supabase.');
  const rows=await supabaseRequest(`sac_candidates?select=id,student_name,programme&sac_session_id=eq.${encodeURIComponent(session.id)}&reference_no=eq.${encodeURIComponent(ref)}&limit=1`);
  const candidate=Array.isArray(rows)?rows[0]:null;if(!candidate)throw new Error('SAC candidate not found in this session.');
  const now=new Date().toISOString();
  await supabaseRequest(`sac_candidates?id=eq.${encodeURIComponent(candidate.id)}`,'PATCH',{decision,reviewer_remarks:data?.remarks||'',decision_by:updatedBy||'Admin Portal V2',decision_at:now,updated_at:now});
  await supabaseRequest('sac_decisions','POST',[{sac_candidate_id:candidate.id,decision,remarks:data?.remarks||'',decided_by:updatedBy||'Admin Portal V2',decided_at:now,source:'ADMIN_PORTAL',metadata:{session_id:legacy,reference_no:ref}}]);
  const nextStage=decision==='DIRECT_ENTRY'?'ELIGIBLE_FOR_OFFER':decision==='INTERNAL_ASSESSMENT'?'INTERNAL_ASSESSMENT':'REJECTED';
  await supabaseRequest('workflow_events','POST',[{reference_no:ref,event_type:'SAC_DECISION_RECORDED',from_stage:'SAC_REVIEW',to_stage:nextStage,actor:updatedBy||'Admin Portal V2',source:'ADMIN_PORTAL_V2',payload:{sac_session_id:legacy,decision}}]);
  return {ok:true,referenceNo:ref,sessionId:legacy,decision,applicationStage:nextStage,workflowSyncStatus:'PENDING_BACKEND_SYNC',canonicalWorkflowEngine:'APPS_SCRIPT_V2',candidate:{'Reference No':ref,'SAC Session ID':legacy,'Student Name':candidate.student_name||'','Programme':candidate.programme||'','Decision':decision}};
}

async function callV2(action, data, password, sessionId, updatedBy) {
  const startedAt = Date.now();
  const response = await fetch(ADMIN_BRIDGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: String(password || ''),
      sessionId: String(sessionId || ''),
      action,
      data: data || {},
      updatedBy: updatedBy || 'Admin Portal V2'
    }),
    redirect: 'follow'
  });

  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error(`Admin bridge returned HTTP ${response.status}.`); }

  if (!response.ok || !parsed || parsed.ok === false) {
    const error = new Error(parsed?.message || `Admin bridge returned HTTP ${response.status}.`);
    error.code = response.status === 401 ? 'ADMIN_AUTH_FAILED' : 'V2_ACTION_FAILED';
    throw error;
  }
  return { parsed, bridgeMs: Date.now() - startedAt };
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
    let result,bridgeMs;
    if(action==='v2CreateSacSessionManual'){
      const directStarted=Date.now();result=await createSacSessionDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;
    }else if(action==='v2RemoveSacCandidate'){
      const directStarted=Date.now();result=await removeSacCandidateDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;
    }else if(action==='v2DeleteSacSessionManual'){
      const directStarted=Date.now();result=await deleteSacSessionDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;
    }else if(action==='v2RecordSacDecisionManual'){
      const directStarted=Date.now();result=await recordSacDecisionDirect(body.data||{},password,body.updatedBy);bridgeMs=Date.now()-directStarted;
    }else{
      ({parsed:result,bridgeMs}=await callV2(action, body.data || {}, password, body.sessionId, body.updatedBy));
    }
    let supabaseMirror='not_applicable';
    if(action.toLowerCase().includes('sac')){try{await mirrorSacAction(action,body.data||{},result,body.updatedBy);supabaseMirror='ok';}catch(mirrorError){supabaseMirror='warning:'+String(mirrorError?.message||'mirror failed');}}
    const totalMs = Date.now() - startedAt;
    res.setHeader('Server-Timing', `bridge;dur=${bridgeMs}, total;dur=${totalMs}`);
    return res.status(200).json({ ok: true, action, result, supabaseMirror, performance: { bridgeMs, totalMs } });
  } catch (error) {
    return res.status(error?.code === 'ADMIN_AUTH_FAILED' ? 401 : 502).json({
      ok: false,
      code: error?.code || 'V2_ACTION_FAILED',
      message: error?.message || 'Unable to complete the Admin V2 action.'
    });
  }
}
