// Isolated synthetic harness. No production spreadsheet, live mail or handover.
const CONFIG={timezone:'Asia/Kuala_Lumpur',get spreadsheetId(){return sandboxProperty_('SHEET')}};
const SB_USER='adiybukhori.ipgs@innovative.edu.my';
const SB_REFERENCE='IUC-ADM-UAT-ACCEPTANCE-20261127';
const SB_NAME='UAT ONLY NOT A STUDENT';
const SB_PREFIX='ACC_ACCEPTANCE_SANDBOX_';
function assertDevIdentity_(){if(String(Session.getEffectiveUser().getEmail()).toLowerCase()!==SB_USER)throw Error('Wrong UAT identity');}
function sandboxProperty_(key){return PropertiesService.getScriptProperties().getProperty(SB_PREFIX+key)||'';}
function sandboxSet_(key,value){PropertiesService.getScriptProperties().setProperty(SB_PREFIX+key,String(value));}
function sandboxSheet_(){assertDevIdentity_();const id=sandboxProperty_('SHEET');if(!id)throw Error('Run setupAcceptanceSandbox first');const ss=SpreadsheetApp.openById(id);if(!ss.getName().startsWith('ACC ACCEPTANCE UAT ONLY'))throw Error('Wrong spreadsheet');return ss;}
function v2OfferEnsureHeaders_(sheet,fields){
 const header=sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0];
 const missing=fields.filter(k=>!header.includes(k));if(missing.length)sheet.getRange(1,header.length+1,1,missing.length).setValues([missing]);
}
function v2Rows_(tab){const sh=sandboxSheet_().getSheetByName(tab);const rows=sh.getDataRange().getDisplayValues();return rows.slice(1).map(r=>Object.fromEntries(rows[0].map((k,i)=>[k,r[i]||''])));}
function v2Find_(tab,key,value){if(value!==SB_REFERENCE||key!=='Reference No')throw Error('Synthetic reference only');const sh=sandboxSheet_().getSheetByName(tab),rows=v2Rows_(tab),i=rows.findIndex(r=>r[key]===value);return i<0?null:{sheet:sh,rowNumber:i+2,record:rows[i]};}
function v2UpdateRow_(sheet,row,fields){if(sheet.getParent().getId()!==CONFIG.spreadsheetId||row!==2)throw Error('Synthetic row only');v2OfferEnsureHeaders_(sheet,Object.keys(fields));const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];for(const [k,v] of Object.entries(fields))sheet.getRange(row,h.indexOf(k)+1).setValue(String(v??''));SpreadsheetApp.flush();}
function v2Audit_(){/* no production audit */}function v2InvalidateCache_(){}
function v2CurrentOfferProgramme_(v){return String(v||'').replace(/^MBA\s*-\s*/i,'')}
function v2NotificationMode_(){return 'UAT_DISABLED'}
function v2SendAcceptanceConfirmationCentral_(){return {sent:false,status:'UAT_DISABLED',mode:'UAT_DISABLED'}}
function setupAcceptanceSandbox(){
 assertDevIdentity_();if(sandboxProperty_('SHEET'))throw Error('Already seeded. Do not reset a test without reviewing prior results.');
 const ss=SpreadsheetApp.create('ACC ACCEPTANCE UAT ONLY - 20261127');
 const folder=DriveApp.createFolder('ACC ACCEPTANCE UAT ONLY - 20261127');
 const offer=DriveApp.getFileById('1BXx6GK7XPIbw8tmF8gmeGr8KUL1opFfCmEoC1TXnxwA').makeCopy('TEMP_UAT_OFFER',folder);
 let pdf;try{const d=DocumentApp.openById(offer.getId());const body=d.getBody();for(const [k,v] of Object.entries({'{{STUDENT_NAME}}':SB_NAME,'{{PROGRAMME_NAME}}':'Master of Business Administration','{{IC}}':'UATNOTREAL','{{INTAKE}}':'January 2027','{{SESSION_MONTH}}':'January','{{SESSION_YEAR}}':'2027','{{REF_NO}}':'UAT/NOT-OFFICIAL','{{OFFER_DATE_LONG}}':'27 November 2026','{{STUDENT_ADDRESS}}':'Fictional test address','{{MATRIX_NO}}':'2699999'})){body.replaceText(v2OfferRegexEscape_(k),v)}d.saveAndClose();pdf=folder.createFile(offer.getAs(MimeType.PDF).setName('UAT_ONLY_Offer.pdf'));}finally{offer.setTrashed(true)}
 const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
 const app={'Reference No':SB_REFERENCE,'Student Name':SB_NAME,'ID / Passport No':'UATNOTREAL','Personal Email':'NO-EMAIL-TEST','Programme':'MBA - Master of Business Administration','Intake':'January 2027','Study Mode':'Full Time','Student Folder URL':folder.getUrl(),'Application Status':'TEST'};
 const wf={...app,'Application Stage':'READY_FOR_SAC','SAC Decision':'PENDING','Assessment Status':'PENDING','Prerequisite Status':'PENDING','Offer Letter Status':'ISSUED','Offer Letter PDF URL':pdf.getUrl(),'Offer Letter Remarks':'Issued by ACC native LOA engine; SKY matric confirmed','Acceptance Status':'PENDING','Acceptance Token Hash':v2OfferHashToken_(token)};
 function seed(sh,obj){sh.getRange(1,1,2,Object.keys(obj).length).setValues([Object.keys(obj),Object.values(obj)]);}
 const a=ss.getSheets()[0];a.setName('V2_APPLICATIONS');seed(a,app);seed(ss.insertSheet('V2_WORKFLOW'),wf);
 sandboxSet_('SHEET',ss.getId());sandboxSet_('TOKEN',token);sandboxSet_('FOLDER',folder.getId());
 console.log(JSON.stringify({ready:true,syntheticOnly:true,spreadsheetUrl:ss.getUrl(),folderUrl:folder.getUrl(),stage:'READY_FOR_SAC',liveEmail:false}));
}
function doGet(e){assertDevIdentity_();const t=HtmlService.createTemplateFromFile('acceptance-v2');t.token=sandboxProperty_('TOKEN');return t.evaluate().setTitle('ACC Acceptance UAT ONLY');}
function verifyAcceptanceSandbox(){
 const w=v2Find_('V2_WORKFLOW','Reference No',SB_REFERENCE).record;
 const fields=['Acceptance PDF URL','Surat Penerimaan Signed PDF URL','Surat Akuan Signed PDF URL','Student Handbook Acknowledgement Signed PDF URL'];
 const ids=fields.map(f=>v2OfferExtractDriveId_(w[f]||''));
 const files=ids.every(id=>{try{const f=DriveApp.getFileById(id),p=f.getParents();let good=false;while(p.hasNext())if(p.next().getId()===sandboxProperty_('FOLDER'))good=true;return good&&!f.isTrashed()&&f.getMimeType()===MimeType.PDF;}catch{return false;}});
 let rejected=false;try{v2ValidateAcceptanceToken_(sandboxProperty_('TOKEN'))}catch{rejected=true}
 const result={accepted:w['Acceptance Status']==='ACCEPTED',packAccepted:w['Acceptance Pack Status']==='ACCEPTED',sacStagePreserved:w['Application Stage']==='READY_FOR_SAC'&&w['SAC Decision']==='PENDING',fourSignedPDFs:files&&new Set(ids).size===4,tokenConsumed:!w['Acceptance Token Hash']&&rejected,syntheticOnly:true};
 console.log(JSON.stringify(result));return result;
}
