/**
 * Admission V2 - Fee Structure Master
 * Source of truth for agent Fee Group selection and payment schedule metadata.
 */
const V2_FEE_STRUCTURE_BUILD = 'FEE_STRUCTURE_MASTER_V1_20260921';

const V2_FEE_STRUCTURE_HEADERS = [
  'Fee Group Code','Fee Structure Name','Programme','Level','Study Mode','Intake Scope',
  'Tuition Fee','Registration Fee','Other Fee','Other Fee Description','Total Fee',
  'Fee Components JSON','Payment Schedule JSON','File ID PDF','Active','Effective From','Effective Until',
  'Notes','Created At','Created By','Updated At','Updated By'
];

function v2FeeStructureEnsureFoundation_(){
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet=ss.getSheetByName(CONFIG.feeGroupMasterSheetName||'FEE_GROUP_MASTER');
  if(!sheet) sheet=ss.insertSheet(CONFIG.feeGroupMasterSheetName||'FEE_GROUP_MASTER');
  v2EnsureHeaders_(sheet,V2_FEE_STRUCTURE_HEADERS);
  v2StyleHeader_(sheet,sheet.getLastColumn());
  return sheet;
}

function v2FeeStructureNumber_(value,label){
  if(value===null||value===undefined||String(value).trim()==='') return 0;
  const n=Number(String(value).replace(/,/g,'').trim());
  if(!isFinite(n)||n<0) throw new Error(label+' must be a valid amount of 0 or above.');
  return Math.round(n*100)/100;
}

function v2FeeStructureDriveId_(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  if(/^[A-Za-z0-9_-]{20,}$/.test(raw)) return raw;
  const patterns=[
    /\/d\/([A-Za-z0-9_-]{20,})/,
    /[?&]id=([A-Za-z0-9_-]{20,})/,
    /\/file\/d\/([A-Za-z0-9_-]{20,})/
  ];
  for(let i=0;i<patterns.length;i++){const m=raw.match(patterns[i]);if(m&&m[1])return m[1];}
  throw new Error('Enter a valid Google Drive file URL or File ID for the Fee Structure PDF.');
}

function v2FeeStructureComponents_(raw){
  let arr=raw;
  if(typeof raw==='string'){
    const t=raw.trim();
    if(!t) return [];
    try{arr=JSON.parse(t);}catch(_){throw new Error('Fee Components are not valid JSON.');}
  }
  if(!Array.isArray(arr)) return [];
  const allowed=[
    'ACADEMIC_FEE',
    'COURSEWORK_FEE',
    'RESEARCH_FEE',
    'MIXED_MODE_FEE',
    'REGISTRATION_FEE',
    'NON_ACADEMIC_FEE'
  ];
  return arr.map(function(item,index){
    const type=String(item&&item.type||'').trim().toUpperCase();
    if(allowed.indexOf(type)<0) throw new Error('Select a valid Fee Component for row '+(index+1)+'.');
    const amount=v2FeeStructureNumber_(item&&item.amount,'Fee Component '+(index+1)+' amount');
    const description=String(item&&item.description||'').trim();
    if(type==='NON_ACADEMIC_FEE'&&!description) throw new Error('Description is required for Other Approved Non-Academic Fee.');
    return {type:type,amount:amount,description:description};
  }).filter(function(x){return x.amount||x.description;});
}

function v2FeeStructureSchedule_(raw){
  let arr=raw;
  if(typeof raw==='string'){
    const t=raw.trim();
    if(!t) return [];
    try{arr=JSON.parse(t);}catch(_){throw new Error('Payment Schedule is not valid JSON.');}
  }
  if(!Array.isArray(arr)) return [];
  return arr.map(function(item,index){
    const label=String(item&&item.label||('Payment '+(index+1))).trim();
    const amount=v2FeeStructureNumber_(item&&item.amount,'Payment '+(index+1)+' amount');
    const due=String(item&&item.due||'').trim();
    const notes=String(item&&item.notes||'').trim();
    return {label:label,amount:amount,due:due,notes:notes};
  }).filter(function(x){return x.label||x.amount||x.due||x.notes;});
}

function v2FeeStructureClearAgentCache_(){
  try{
    const key='V2_FEE_GROUPS_'+String(CONFIG.spreadsheetId||'').slice(-10);
    CacheService.getScriptCache().remove(key);
  }catch(_){}
}

function v2FeeStructureFindByCode_(sheet,code){
  if(!sheet||sheet.getLastRow()<2)return null;
  const values=sheet.getDataRange().getValues();
  const headers=values[0].map(function(v){return String(v||'').trim();});
  const idx=headers.indexOf('Fee Group Code');
  if(idx<0)return null;
  const target=String(code||'').trim().toUpperCase();
  for(let i=1;i<values.length;i++){
    if(String(values[i][idx]||'').trim().toUpperCase()===target){
      const record={};
      headers.forEach(function(h,j){if(h)record[h]=values[i][j];});
      return {sheet:sheet,rowNumber:i+1,record:record};
    }
  }
  return null;
}

function v2UpsertFeeStructure_(data,actor){
  const sheet=v2FeeStructureEnsureFoundation_();
  const code=String(data.feeGroupCode||data.code||'').trim();
  if(!code) throw new Error('Fee Group Code is required.');
  if(code.length>100||/[\r\n]/.test(code)) throw new Error('Fee Group Code is invalid.');

  const name=String(data.feeStructureName||data.name||'').trim();
  const programme=String(data.programme||'ALL').trim()||'ALL';
  const level=String(data.level||'').trim();
  const studyMode=String(data.studyMode||'').trim();
  const intakeScope=String(data.intakeScope||'ALL').trim()||'ALL';
  const components=v2FeeStructureComponents_(data.feeComponents||data.feeComponentsJson||[]);
  let tuition=0,registration=0,other=0;
  const otherDescriptions=[];
  components.forEach(function(item){
    if(['ACADEMIC_FEE','COURSEWORK_FEE','RESEARCH_FEE','MIXED_MODE_FEE'].indexOf(item.type)>-1) tuition+=Number(item.amount||0);
    else if(item.type==='REGISTRATION_FEE') registration+=Number(item.amount||0);
    else {
      other+=Number(item.amount||0);
      if(item.description) otherDescriptions.push(item.description);
    }
  });
  if(!components.length){
    tuition=v2FeeStructureNumber_(data.tuitionFee,'Academic Fee');
    registration=v2FeeStructureNumber_(data.registrationFee,'Registration Fee');
    other=v2FeeStructureNumber_(data.otherFee,'Other Fee');
    if(String(data.otherFeeDescription||'').trim()) otherDescriptions.push(String(data.otherFeeDescription||'').trim());
  }
  tuition=Math.round(tuition*100)/100;
  registration=Math.round(registration*100)/100;
  other=Math.round(other*100)/100;
  const totalInput=String(data.totalFee===undefined?'':data.totalFee).trim();
  const total=totalInput===''?Math.round((tuition+registration+other)*100)/100:v2FeeStructureNumber_(data.totalFee,'Total Fee');
  const schedule=v2FeeStructureSchedule_(data.paymentSchedule||data.paymentScheduleJson||[]);
  const fileId=v2FeeStructureDriveId_(data.fileIdPdf||data.fileUrl||'');
  const active=String(data.active===true?'ACTIVE':data.active||'INACTIVE').toUpperCase()==='ACTIVE'?'ACTIVE':'INACTIVE';
  const effectiveFrom=String(data.effectiveFrom||'').trim();
  const effectiveUntil=String(data.effectiveUntil||'').trim();
  const notes=String(data.notes||'').trim();

  if(active==='ACTIVE'&&!fileId) throw new Error('Add the Fee Structure PDF before activating this Fee Group.');
  let fileName='';
  if(fileId){
    try{const file=DriveApp.getFileById(fileId);fileName=file.getName();}
    catch(_){throw new Error('The Fee Structure PDF file cannot be accessed from Google Drive.');}
  }

  const found=v2FeeStructureFindByCode_(sheet,code);
  const now=new Date().toISOString();
  const patch={
    'Fee Group Code':code,'Fee Structure Name':name,'Programme':programme,'Level':level,
    'Study Mode':studyMode,'Intake Scope':intakeScope,'Tuition Fee':tuition,
    'Registration Fee':registration,'Other Fee':other,'Other Fee Description':otherDescriptions.join('; '),
    'Total Fee':total,'Fee Components JSON':JSON.stringify(components),'Payment Schedule JSON':JSON.stringify(schedule),'File ID PDF':fileId,
    'Active':active,'Effective From':effectiveFrom,'Effective Until':effectiveUntil,'Notes':notes,
    'Updated At':now,'Updated By':actor||'Admin Portal V2'
  };
  if(found){
    v2UpdateRow_(sheet,found.rowNumber,patch);
  }else{
    patch['Created At']=now;patch['Created By']=actor||'Admin Portal V2';
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    sheet.appendRow(headers.map(function(h){return Object.prototype.hasOwnProperty.call(patch,h)?patch[h]:'';}));
  }

  v2FeeStructureClearAgentCache_();
  v2Audit_('','FEE_STRUCTURE',found?'UPDATE_FEE_STRUCTURE':'CREATE_FEE_STRUCTURE',
    found?found.record:{},{feeGroupCode:code,active:active,programme:programme,totalFee:total,fileName:fileName},
    actor||'Admin Portal V2','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true,feeGroupCode:code,active:active,totalFee:total,fileIdPdf:fileId,fileName:fileName,feeComponents:components,paymentSchedule:schedule};
}

function v2SetFeeStructureStatus_(data,actor){
  const sheet=v2FeeStructureEnsureFoundation_();
  const code=v2Required_(data.feeGroupCode||data.code,'Fee Group Code');
  const found=v2FeeStructureFindByCode_(sheet,code);
  if(!found) throw new Error('Fee Structure not found.');
  const active=String(data.active===true?'ACTIVE':data.active||'INACTIVE').toUpperCase()==='ACTIVE'?'ACTIVE':'INACTIVE';
  if(active==='ACTIVE'){
    const fileId=String(found.record['File ID PDF']||'').trim();
    if(!fileId) throw new Error('Add the Fee Structure PDF before activating this Fee Group.');
    try{DriveApp.getFileById(fileId).getName();}catch(_){throw new Error('The mapped Fee Structure PDF is not accessible.');}
  }
  const now=new Date().toISOString();
  v2UpdateRow_(sheet,found.rowNumber,{'Active':active,'Updated At':now,'Updated By':actor||'Admin Portal V2'});
  v2FeeStructureClearAgentCache_();
  v2Audit_('','FEE_STRUCTURE','SET_FEE_STRUCTURE_STATUS',{active:found.record['Active']||''},{feeGroupCode:code,active:active},actor||'Admin Portal V2','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true,feeGroupCode:code,active:active};
}

function v2GetFeeGroupOptions_(programme){
  const sheet=v2FeeStructureEnsureFoundation_();
  if(sheet.getLastRow()<2)return [];
  const rows=v2Rows_(CONFIG.feeGroupMasterSheetName||'FEE_GROUP_MASTER');
  const target=String(programme||'').trim().toUpperCase();
  const now=new Date();
  return rows.filter(function(row){
    const code=String(row['Fee Group Code']||'').trim();if(!code)return false;
    const active=String(row['Active']||'ACTIVE').trim().toUpperCase();
    if(active&&!['ACTIVE','YES','TRUE','1'].includes(active))return false;
    const scope=String(row['Programme']||'ALL').trim().toUpperCase();
    if(target&&scope&&scope!=='ALL'&&scope!==target)return false;
    const from=String(row['Effective From']||'').trim(),until=String(row['Effective Until']||'').trim();
    if(from){const d=new Date(from+'T00:00:00');if(!isNaN(d)&&now<d)return false;}
    if(until){const d=new Date(until+'T23:59:59');if(!isNaN(d)&&now>d)return false;}
    return true;
  }).map(function(row){
    const total=Number(row['Total Fee']||0);
    const name=String(row['Fee Structure Name']||'').trim();
    const code=String(row['Fee Group Code']||'').trim();
    return {
      code:code,
      label:[code,name,total?('RM'+total.toLocaleString('en-MY',{minimumFractionDigits:0,maximumFractionDigits:2})):'' ].filter(Boolean).join(' · '),
      name:name,
      programme:String(row['Programme']||'ALL'),
      totalFee:total
    };
  }).sort(function(a,b){return a.code.localeCompare(b.code);});
}
