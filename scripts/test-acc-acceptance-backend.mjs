// Exercises only the staged Apps Script acceptance finaliser with fake records.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
const source=readFileSync(process.argv[2],'utf8');
const start=source.indexOf('function v2AcceptOffer_(rawToken, data, actor) {');
assert.ok(start>=0);
const fn=source.slice(start,source.indexOf('\nfunction ',start+1));
const hash=x=>createHash('sha256').update(x).digest('hex');
const raw='a'.repeat(64);
const signed=['Acceptance PDF URL','Surat Penerimaan Signed PDF URL','Surat Akuan Signed PDF URL','Student Handbook Acknowledgement Signed PDF URL'];
function test(stage,{native=true,complete=true,status='ISSUED',token=raw}={}){
 const row={'Reference No':'IUC-ADM-SYNTHETIC','Application Stage':stage,
  'SAC Decision':'PENDING','Offer Letter Status':status,'Acceptance Status':'PENDING',
  'Acceptance Token Hash':hash(raw),'Acceptance Pack Status':complete?'SIGNED':'PENDING',
  'Offer Letter Remarks':native?'Issued by ACC native LOA engine; SKY matric confirmed':''};
 for(const k of signed)row[k]=complete?'https://drive.google.com/file/d/test/view':'';
 let writes=0;
 const ctx={assertDevIdentity_:()=>{},v2OfferHashToken_:hash,v2Rows_:()=>[row],
  v2Find_:()=>({record:row,sheet:{},rowNumber:2}),v2AcceptancePackUrlExists_:url=>!!url,
  v2UpdateRow_:(_s,_r,changes)=>{writes++;Object.assign(row,changes);},v2Audit_:()=>{},v2InvalidateCache_:()=>{}};
 runInNewContext(fn,ctx);
 return {row,accept:()=>ctx.v2AcceptOffer_(token,{signedName:'SYNTHETIC',declarationAccepted:true},'UAT'),writes:()=>writes};
}
for(const stage of ['READY_FOR_SAC','INTERNAL_ASSESSMENT','PREREQUISITE','ELIGIBLE_FOR_OFFER']){
 const x=test(stage); const result=x.accept();
 assert.equal(result.acceptanceStatus,'ACCEPTED');assert.equal(result.applicationStage,stage);
 assert.equal(x.row['Application Stage'],stage);assert.equal(x.row['SAC Decision'],'PENDING');
 assert.equal(x.row['Acceptance Token Hash'],'');assert.equal(x.writes(),1);
 assert.throws(x.accept,/Invalid or expired/);
}
const incomplete=test('READY_FOR_SAC',{complete:false});assert.throws(incomplete.accept,/four signed/);assert.equal(incomplete.writes(),0);
const legacy=test('OFFER_ISSUED',{native:false});legacy.accept();assert.equal(legacy.row['Application Stage'],'ACCEPTED');
assert.throws(test('READY_FOR_SAC',{native:false}).accept,/invalid application stage/);
assert.throws(test('READY_FOR_SAC',{status:'NOT_ISSUED'}).accept,/not been issued/);
assert.throws(test('READY_FOR_SAC',{token:'b'.repeat(64)}).accept,/Invalid or expired/);
console.log('PASS: native signing finalisation preserves SAC/IA/PR, requires 4 signed documents, consumes token once, rejects bad token, legacy gate unchanged. NO REAL RECORDS.');