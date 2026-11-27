// Pure revision policy. No network, email or mutation of the existing acceptance.
const mode=v=>String(v||'').trim().replace(/[-\s]+/g,' ').toLowerCase();
export const normalizeStudyMode=v=>({ 'full time':'Full-Time','part time':'Part-Time' })[mode(v)]||'';
const signedFields=['Acceptance PDF URL','Surat Penerimaan Signed PDF URL','Surat Akuan Signed PDF URL','Student Handbook Acknowledgement Signed PDF URL'];
const pdfUrl=v=>/^https:\/\/drive\.google\.com\/file\/d\/[-\w]+\/view(?:\?.*)?$/.test(String(v||''));
function revisionDate(value){const d=new Date(value);if(!value||!Number.isFinite(d.valueOf()))throw Error('Revision timestamp missing or invalid');return d.toISOString();}
export function prepareLoaRevision({referenceNo,application,workflow,ledger,job,nextStudyMode,reason,registryConfirmed=false,revision=1}){
 if(!/^IUC-ADM-[A-Za-z0-9-]{3,160}$/.test(referenceNo||'')||application?.['Reference No']!==referenceNo||workflow?.['Reference No']!==referenceNo||ledger?.reference_no!==referenceNo)throw Error('Reference mismatch');
 const previous=normalizeStudyMode(application['Study Mode']),next=normalizeStudyMode(nextStudyMode);
 if(!previous||!next||previous===next)throw Error('A different valid Study Mode is required');
 if(typeof reason!=='string'||!reason.trim()||reason.trim().length>300)throw Error('Revision reason required');
 if(!Number.isInteger(revision)||revision<1||revision>999)throw Error('Invalid current revision');
 if(ledger.status!=='SENT'||!ledger.gmail_message_id||workflow['Offer Letter Status']!=='ISSUED'||workflow['Offer Email Status']!=='LIVE_SENT_1')throw Error('Prior issuance must be confirmed');
 if(job&&!['SENT'].includes(job.status))throw Error('Prior job not settled');
 if(!pdfUrl(workflow['Offer Letter PDF URL']))throw Error('Original LOA missing');
 const pdfs=ledger.pdf_files;
 if(!Array.isArray(pdfs)||pdfs.length!==4||new Set(pdfs.map(x=>x.id)).size!==4||pdfs.some(x=>!x.id||!x.name||!pdfUrl(x.url))||pdfs[0].url!==workflow['Offer Letter PDF URL'])throw Error('Original PDF set incomplete');
 const state=String(workflow['Acceptance Status']||'').toUpperCase(),pack=String(workflow['Acceptance Pack Status']||'').toUpperCase(),mail=String(workflow['Acceptance Confirmation Email Status']||'').toUpperCase();
 if(['GATEWAY_QUEUED','GATEWAY_ACCEPTANCE_SENDING','REVIEW_REQUIRED'].includes(mail)||['SIGNED','SIGNATURE_FAILED'].includes(pack))throw Error('Acceptance requires review before revision');
 if(!['PENDING','ACCEPTED'].includes(state))throw Error('Acceptance status requires review');
 const signed=signedFields.map(k=>workflow[k]||'');
 if(state==='ACCEPTED'){
  if(registryConfirmed!==true)throw Error('Signed acceptance requires explicit Registry confirmation');
  if(pack!=='ACCEPTED'||!/^LIVE_SENT_/.test(mail)||signed.some(x=>!pdfUrl(x))||new Set(signed).size!==4)throw Error('Signed acceptance or confirmation incomplete');
 }else if(signed.some(Boolean)||pack==='ACCEPTED')throw Error('Partial signed acceptance requires review');
 // No old signing URL, hash, credentials, or raw student application in history.
 return Object.freeze({referenceNo,revision:revision+1,nextStudyMode:next,reason:reason.trim(),registryConfirmed:registryConfirmed===true,expectedOfferUrl:workflow['Offer Letter PDF URL'],expectedAcceptanceStatus:state,
  previous:Object.freeze({revision,studyMode:previous,acceptanceStatus:state,offerIssuedAt:revisionDate(ledger.sent_at||workflow['Offer Letter Issued At']),acceptedAt:state==='ACCEPTED'?revisionDate(workflow['Acceptance Signed At']||workflow['Acceptance Received At']):'',emailMessageId:ledger.gmail_message_id,pdfFiles:pdfs.map(({id,name,url})=>({id,name,url})),signedDocumentUrls:signed.filter(Boolean)})});
}
export function revisionPdfName(original,revision){
 if(!Number.isInteger(revision)||revision<2||revision>1000||!/^([A-Za-z0-9_]+)\.pdf$/.test(original))throw Error('Invalid revised filename');
 return original.replace(/\.pdf$/,'_R'+String(revision).padStart(2,'0')+'.pdf');
}
