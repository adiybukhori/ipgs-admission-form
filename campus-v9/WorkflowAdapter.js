import{BY_ID,ROUTES}from'./config.js';
import{ApplicantActor}from'./ApplicantActor.js';

const TABLES={
  applications:'V2_APPLICATIONS',workflow:'V2_WORKFLOW',documents:'V2_DOCUMENT_REVIEW',ai:'V2_AI_SCREENING',qualification:'V2_QUALIFICATION_SCREENING',
  sac:'V2_SAC_CANDIDATES',assessment:'V2_ASSESSMENT_PROGRESS',orientation:'V2_ORIENTATION_TRACKING',provisioning:'V2_PROVISIONING',handover:'V2_HANDOVER_STUDENTS',
  events:'V2_AGENT_EVENTS',executions:'V2_AGENT_EXECUTIONS',human:'V2_HUMAN_TASKS'
};
const asRows=(data,key)=>Array.isArray(data?.[key])?data[key]:[];
const pick=(row,keys)=>{for(const k of keys){const v=row?.[k];if(v!==undefined&&String(v).trim()!=='')return String(v).trim();}return'';};
const refOf=row=>pick(row,['Reference No','Ref No','Application Ref','Reference','Application ID','Applicant Reference']);
const nameOf=row=>pick(row,['Student Name','Applicant Name','Full Name','Name'])||refOf(row)||'Student';
const allText=row=>Object.values(row||{}).join(' ').toUpperCase();
const norm=v=>String(v||'').trim().toUpperCase().replace(/[\s\-/]+/g,'_').replace(/[^A-Z0-9_]/g,'');
const indexLatest=rows=>{const m=new Map();for(const row of rows){const ref=refOf(row);if(ref)m.set(ref,row);}return m;};
const has=(txt,parts)=>parts.some(x=>txt.includes(x));
const isClosed=txt=>has(txt,['COMPLETED','COMPLETE','CLOSED','DONE','RESOLVED','FINALISED','FINALIZED','PASSED']);

function stageFromValue(value,assessmentText=''){
  const s=norm(value);
  if(!s)return null;
  if(has(s,['COMPLETED','ACADEMIC_HANDOVER','HANDOVER']))return['handover',s==='COMPLETED'?'COMPLETED':'HANDOVER'];
  if(has(s,['PROVISIONING','ACCOUNT_CREATION','STUDENT_SERVICES','SKY_ACTIVATION','ACTIVATION']))return['services','PROVISIONING'];
  if(has(s,['ORIENTATION','ACCEPTED']))return['orientation','WAITING_ORIENTATION'];
  if(has(s,['ELIGIBLE_FOR_OFFER','OFFER_ISSUED','OFFICIAL_OFFER','OFFER','LOA','ACCEPTANCE']))return['offer','PROCESSING'];
  if(has(s,['PREREQUISITE','PREREQ']))return['prerequisite','WAITING_PREREQUISITE'];
  if(has(s,['INTERNAL_ASSESSMENT','ASSESSMENT','_IA','IA_'])||s==='IA')return has(assessmentText,['PREREQUISITE','PREREQ'])?['prerequisite','WAITING_PREREQUISITE']:['ia','WAITING_IA'];
  if(has(s,['READY_FOR_SAC','SAC_PENDING','SAC_SESSION'])||s==='SAC')return['sac','WAITING_SAC_SESSION'];
  if(has(s,['QUALIFICATION_SCREENING','AI_SCREENING','SCREENING','RECOMMENDATION','PRE_SAC']))return['screening','PROCESSING'];
  if(has(s,['DOCUMENT_REVIEW','DOCUMENT_CHECK','DOCUMENT_QUALITY','DOCUMENT']))return['document','PROCESSING'];
  if(has(s,['APPLICATION_RECEIVED','NEW_APPLICATION','APPLICATION']))return['admission','WAITING_NEW_APPLICATION'];
  return null;
}

function fallbackStage(ctx){
  const hand=allText(ctx.handover);if(ctx.handover&&hand&&!has(hand,['NOT STARTED','NOT_STARTED']))return['handover',isClosed(hand)?'COMPLETED':'HANDOVER'];
  const prov=allText(ctx.provisioning);if(ctx.provisioning&&prov&&!has(prov,['NOT STARTED','NOT_STARTED']))return['services','PROVISIONING'];
  const ori=allText(ctx.orientation);if(ctx.orientation&&ori&&!isClosed(ori))return['orientation','WAITING_ORIENTATION'];
  const ass=allText(ctx.assessment);if(ctx.assessment){if(has(ass,['PREREQUISITE','PREREQ'])&&!isClosed(ass))return['prerequisite','WAITING_PREREQUISITE'];if(!isClosed(ass))return['ia','WAITING_IA'];}
  if(ctx.sac)return['sac','WAITING_SAC_SESSION'];
  if(ctx.qualification||ctx.ai)return['screening','PROCESSING'];
  if(ctx.documents)return['document','PROCESSING'];
  return['admission','WAITING_NEW_APPLICATION'];
}


const completed=v=>has(norm(v),['COMPLETED','COMPLETE','DONE','PASSED','APPROVED','ACCEPTED','RECEIVED']);
const offerIssued=v=>has(norm(v),['ISSUED','SENT','COMPLETED','COMPLETE']);
const pending=v=>!v||has(norm(v),['PENDING','WAITING','NOT_ISSUED','NOT_STARTED','IN_PROGRESS','DRAFT']);
const decisionStatus=v=>norm(v);
function resolveLiveStage(ctx,app,sourceStage){
  const workflow=ctx.workflow||{};
  const sac=ctx.sac||{};
  const sacSession=pick(sac,['SAC Session ID','Session ID','SAC ID'])||pick(workflow,['SAC Session ID','SAC Session']);
  const sacAssigned=Boolean(sacSession);
  const decision=decisionStatus(pick(workflow,['SAC Decision','SAC Supabase Decision'])||pick(sac,['Decision','SAC Decision']));
  const isDecisionMade=Boolean(decision)&&!has(decision,['PENDING','NOT_STARTED','NOT_ASSIGNED','DRAFT']);
  const assStatus=pick(workflow,['Assessment Status'])||pick(ctx.assessment,['Status']);
  const prereqStatus=pick(workflow,['Prerequisite Status']);
  const offerStatus=pick(workflow,['Offer Letter Status','LOA Status']);
  const acceptanceStatus=pick(workflow,['Acceptance Status']);
  const stage=norm(sourceStage);
  // Academic handover requires authoritative handover evidence, not a Sky activation.
  const handoverText=allText(ctx.handover);
  if(ctx.handover&&handoverText&&!has(handoverText,['NOT STARTED','NOT_STARTED']))return ['handover',isClosed(handoverText)?'COMPLETED':'HANDOVER'];
  // Open admissions: Sky activation and orientation never replace pending SAC/LOA/acceptance.
  if(isDecisionMade&&has(decision,['NOT_QUALIFIED','REJECTED','UNSUCCESSFUL']))return ['sac','WAITING_HUMAN_DECISION'];
  if(isDecisionMade&&has(decision,['PREREQUISITE','PREREQ'])&&!completed(prereqStatus))return ['prerequisite','WAITING_PREREQUISITE'];
  if(isDecisionMade&&has(decision,['INTERNAL_ASSESSMENT','IA_REQUIRED','ASSESSMENT_REQUIRED'])&&!completed(assStatus))return ['ia','WAITING_IA'];
  const assessed=norm(pick(ctx.assessment,['Assessment Type','Status']));
  if(isDecisionMade&&has(assessed,['PREREQUISITE','PREREQ'])&&!isClosed(allText(ctx.assessment)))return ['prerequisite','WAITING_PREREQUISITE'];
  if(isDecisionMade&&has(assessed,['INTERNAL_ASSESSMENT','IA_REQUIRED'])&&!isClosed(allText(ctx.assessment)))return ['ia','WAITING_IA'];
  if(sacAssigned&&!isDecisionMade)return ['sac','WAITING_SAC_SESSION'];
  if(isDecisionMade||has(stage,['OFFER','LOA','ACCEPTANCE','ACCEPTED'])||offerStatus||acceptanceStatus){
    if(completed(acceptanceStatus)&&offerIssued(offerStatus))return ['services','PROVISIONING'];
    return ['offer',offerIssued(offerStatus)?'WAITING_ACCEPTANCE':'PROCESSING'];
  }
  // Never infer SAC assignment from document review, screening or SKY_ACTIVATED.
  return ['admission','WAITING_SAC_ASSIGNMENT'];
}
function currentOrientationVisit(ctx){
  const row=ctx.orientation;
  if(!row)return false;
  const phase=norm(pick(row,['Session Status','Orientation Status','Status','Attendance Status']));
  return ['IN_PROGRESS','ONGOING','SESSION_STARTED','LIVE_SESSION'].includes(phase);
}

function routeFor(station,assessmentText){
  if(station==='prerequisite'||has(assessmentText,['PREREQUISITE','PREREQ']))return ROUTES.prerequisite;
  if(station==='ia'||has(assessmentText,['INTERNAL ASSESSMENT','ASSESSMENT',' IA ']))return ROUTES.ia;
  return ROUTES.direct;
}

function newestAgentSignal(ref,data){
  const rows=[...asRows(data,TABLES.events),...asRows(data,TABLES.executions)].filter(r=>refOf(r)===ref);
  const row=rows[rows.length-1]||null;
  return row?pick(row,['Task','Action','Event Type','Event','Agent','Agent Name']):'';
}

function openHumanTask(ref,data){
  return asRows(data,TABLES.human).find(r=>refOf(r)===ref&&!isClosed(allText(r)))||null;
}

export class WorkflowAdapter{
  static normalize(data){
    const apps=asRows(data,TABLES.applications);
    const maps={};
    for(const [k,t] of Object.entries(TABLES))if(!['applications','events','executions','human'].includes(k))maps[k]=indexLatest(asRows(data,t));
    return apps.filter(refOf).map((app,index)=>{
      const ref=refOf(app),ctx={};for(const k of Object.keys(maps))ctx[k]=maps[k].get(ref)||null;
      const assessmentText=allText(ctx.assessment);
      const sourceStage=pick(ctx.workflow,['Application Stage','Stage','Workflow Stage','Current Stage'])||pick(app,['Application Stage','Stage','Status']);
      let resolved=resolveLiveStage(ctx,app,sourceStage);
      const primaryStation=resolved[0];
      if(currentOrientationVisit(ctx))resolved=['orientation','ORIENTATION_IN_PROGRESS'];
      const human=openHumanTask(ref,data);if(human)resolved=[resolved[0],'WAITING_HUMAN_DECISION'];
      const [station,status]=resolved,route=routeFor(primaryStation,assessmentText);
      const signal=newestAgentSignal(ref,data);
      const waitSince=pick(ctx.workflow,['Last Updated','Updated At','Modified At'])||pick(app,['Submitted At','Timestamp','Created At'])||null;
      return{
        id:ref,name:nameOf(app),programme:pick(app,['Programme','Program','Programme Applied']),station,status,primaryStation,sourceStage:sourceStage||primaryStation.toUpperCase(),
        reason:human?'Human decision / evidence is currently required':station==='orientation'?`Orientation in progress · primary stage: ${primaryStation}`:`Live Admission V2 · ${sourceStage||primaryStation}`,
        waitingSince:waitSince,task:signal||BY_ID[station]?.tasks?.[0]||'Admission workflow',route,routeName:route===ROUTES.prerequisite?'prerequisite':route===ROUTES.ia?'ia':'direct',
        index:Math.max(0,route.indexOf(station)),next:station,profile:index%8,live:true
      };
    });
  }

  static async fetchSnapshot(password){
    const response=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(30000)});
    const result=await response.json();
    if(!response.ok||!result.ok)throw Error(result.message||'Unable to load Admission V2');
    if(!Array.isArray(result.data?.V2_APPLICATIONS))throw Error('No application table was returned');
    return{records:this.normalize(result.data),raw:result.data,warnings:result.warnings||[],loadedAt:result.loadedAt};
  }

  static target(engine,record,slot){
    const s=BY_ID[record.station]||BY_ID.admission;
    let p;
    if(record.station==='orientation'&&engine.scene.orientationSeats?.length)p=engine.scene.orientationSeats[slot%engine.scene.orientationSeats.length];
    else{
      const cols=record.station==='handover'?4:record.station==='services'?5:6;
      const spreadX=Math.min(76,Math.max(46,(s.w-150)/Math.max(1,cols-1)));
      const col=slot%cols,row=Math.floor(slot/cols)%6;
      p={x:s.point.x+(col-(cols-1)/2)*spreadX,y:s.point.y+(row-1.5)*48};
    }
    return engine.scene.nav.point(engine.scene.nav.nearest(p));
  }

  static apply(engine,records){return this.sync(engine,records,{instant:true});}

  static sync(engine,records,{instant=false}={}){
    engine.live=true;engine.paused=false;
    const first=!engine.__liveInitialized;engine.__liveInitialized=true;
    const old=new Map((engine.apps||[]).map(a=>[a.id,a]));
    const counts={},next=[];
    for(let i=0;i<records.length;i++){
      const r=records[i],slot=counts[r.station]||0;counts[r.station]=slot+1;
      const target=this.target(engine,r,slot);let a=old.get(r.id);
      if(!a){
        const spawn=(first||instant)?target:this.target(engine,{...r,station:'admission'},counts.admission||0);
        a=new ApplicantActor(r,spawn.x,spawn.y,r.profile??i%8);
        if(!(first||instant)&&r.station!=='admission')engine.move(a,target,()=>{if(r.station==='orientation')a.sit();else a.pose='idle';});
      }else{
        const previous=a.station;
        Object.assign(a,r);a.station=r.station;a.next=r.station;a.live=true;
        if(previous!==r.station){
          a.path=[];a.onArrive=null;a.sitting=false;a.pose='walking';
          engine.move(a,target,()=>{if(r.station==='orientation')a.sit();else a.pose='idle';});
          engine.emit?.('LIVE_STAGE_CHANGED',a,`${previous||'admission'} → ${r.station}`);
        }else if(r.station==='orientation'&&!a.path.length)a.sit();
      }
      next.push(a);
    }
    engine.apps=next;engine.scene.actors=next;
    engine.screen('LIVE ADMISSION V2',`${records.length} students · read-only process view`);
    return{total:records.length,counts};
  }
}
