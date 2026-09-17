from pathlib import Path
import re
import sys

MODE = sys.argv[1] if len(sys.argv) > 1 else ''

PG_ADM_JS = r'''/**
 * Admission V2 - Controlled PG-ADM-01 generator
 *
 * Stage 2 reliability rules:
 * - Clone the approved controlled Google Docs master template; do not rebuild the visual design.
 * - Generate for every V2 admission and refresh before SAC printing.
 * - Save exactly one current PDF in the student folder using 00_ prefix.
 * - Track GENERATED / FAILED status and error details in V2_WORKFLOW.
 * - V1 is never read or modified.
 */

const V2_PG_ADM01_BUILD = 'PG_ADM_01_CONTROLLED_V2_20260917';
const V2_PG_ADM01_VERSION = 'PG-ADM-01-V2-CONTROLLED';
const V2_PG_ADM01_MASTER_TEMPLATE_ID = '1TweYhiWWoh6S-PHciBRpxACQSrQfhGkIo8kWQEcKleU';
const V2_PG_ADM01_CONTROLLED_REFERENCE_PDF_ID = '1oAVVfCzHdOesKfOSPX30M0xJxXXaIJQ4';
const V2_PG_ADM01_WORKFLOW_HEADERS = [
  'PG-ADM-01 Status',
  'PG-ADM-01 URL',
  'PG-ADM-01 Generated At',
  'PG-ADM-01 Error',
  'PG-ADM-01 Version',
  'PG-ADM-01 Source'
];

function v2PgAdm01EnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('V2_WORKFLOW');
  if (!sheet) throw new Error('V2_WORKFLOW sheet not found.');
  v2EnsureHeaders_(sheet, V2_PG_ADM01_WORKFLOW_HEADERS);
  return sheet;
}

function v2PgAdm01UpdateStatus_(reference, values) {
  v2PgAdm01EnsureHeaders_();
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!workflow) return false;
  const patch = Object.assign({'Last Updated':new Date().toISOString()}, values || {});
  v2UpdateRow_(workflow.sheet, workflow.rowNumber, patch);
  return true;
}

function v2GeneratePgEligibilityPdf_(referenceNo, sessionId, actor) {
  const reference = String(referenceNo || '').trim();
  const generatedBy = String(actor || 'System').trim();
  if (!reference) throw new Error('Reference No is required for PG-ADM-01.');

  v2PgAdm01UpdateStatus_(reference, {
    'PG-ADM-01 Status':'GENERATING',
    'PG-ADM-01 Error':'',
    'PG-ADM-01 Version':V2_PG_ADM01_VERSION,
    'PG-ADM-01 Source':'CONTROLLED_MASTER_TEMPLATE'
  });

  try {
    const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
    if (!application) throw new Error('V2 application record not found for PG-ADM-01.');
    const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    const app = application.record;
    const flow = workflow ? workflow.record : {};

    const folderId = v2PgAdm01ExtractDriveId_(app['Student Folder URL'] || flow['Student Folder URL'] || '');
    if (!folderId) throw new Error('Student folder could not be resolved for PG-ADM-01.');
    const folder = DriveApp.getFolderById(folderId);

    const raw = v2PgAdm01ParseJson_(app['Raw Application JSON'], {});
    const studentName = String(app['Student Name'] || flow['Student Name'] || '').trim();
    const programme = String(app['Programme'] || flow['Programme'] || '').trim();
    const level = String(app['Level of Study'] || flow['Level of Study'] || '').trim();
    const intake = v2OfferDisplayIntake_(app['Intake'] || flow['Intake'] || '');
    const highestQualification = String(app['Highest Qualification'] || '').trim();
    const institution = String(app['Institution / Awarding Body'] || '').trim();
    const field = String(app['Field of Study'] || '').trim();
    const result = String(app['Academic Result / CGPA / Grade'] || '').trim();
    const nationality = String(raw.nationality || raw.country || '').trim();

    let meetingDate = '';
    const sacSessionId = String(sessionId || flow['SAC Session ID'] || '').trim();
    if (sacSessionId) {
      const session = v2Find_('V2_SAC_SESSIONS','SAC Session ID',sacSessionId);
      if (session) meetingDate = v2PgAdm01DisplayDate_(session.record['Meeting Date'] || '');
    }

    const safeName = v2PgAdm01Safe_(studentName || reference);
    const safeRef = v2PgAdm01Safe_(reference);
    const pdfName = '00_PG-ADM-01_' + safeName + '_' + safeRef + '.pdf';

    v2PgAdm01TrashMatching_(folder, pdfName);
    v2PgAdm01TrashMatching_(folder, 'PG-ADM-01_' + safeName + '_' + safeRef + '.pdf');

    const master = DriveApp.getFileById(V2_PG_ADM01_MASTER_TEMPLATE_ID);
    const temp = master.makeCopy('TEMP_' + pdfName.replace(/\.pdf$/i,''), folder);
    const doc = DocumentApp.openById(temp.getId());
    const body = doc.getBody();

    v2PgAdm01ReplaceField_(body, 'Applicant Name', studentName);
    v2PgAdm01ReplaceField_(body, 'Application No\\.', reference);
    v2PgAdm01ReplaceField_(body, 'Programme', programme);
    v2PgAdm01ReplaceField_(body, 'Intake', intake);
    v2PgAdm01ReplaceField_(body, 'Nationality', nationality);
    v2PgAdm01ReplaceField_(body, 'Level of Study', level);
    v2PgAdm01ReplaceField_(body, 'Highest Qualification', highestQualification);
    v2PgAdm01ReplaceField_(body, 'Institution', institution);
    v2PgAdm01ReplaceField_(body, 'Field / Major', field);
    v2PgAdm01ReplaceField_(body, 'CGPA / Equivalent', result);
    if (sacSessionId) v2PgAdm01ReplaceField_(body, 'SAC Session ID', sacSessionId);
    if (meetingDate) v2PgAdm01ReplaceField_(body, 'Meeting Date', meetingDate);

    doc.saveAndClose();
    const pdfBlob = temp.getBlob().getAs(MimeType.PDF).setName(pdfName);
    const pdfFile = folder.createFile(pdfBlob);
    try { temp.setTrashed(true); } catch (_) {}

    const now = new Date().toISOString();
    v2PgAdm01UpdateStatus_(reference, {
      'PG-ADM-01 Status':'GENERATED',
      'PG-ADM-01 URL':pdfFile.getUrl(),
      'PG-ADM-01 Generated At':now,
      'PG-ADM-01 Error':'',
      'PG-ADM-01 Version':V2_PG_ADM01_VERSION,
      'PG-ADM-01 Source':'CONTROLLED_MASTER_TEMPLATE'
    });

    try {
      v2Audit_(reference, sacSessionId ? 'SAC' : 'ADMISSION', 'GENERATE_PG_ADM_01', {}, {
        sessionId:sacSessionId,
        fileName:pdfName,
        url:pdfFile.getUrl(),
        version:V2_PG_ADM01_VERSION,
        source:'CONTROLLED_MASTER_TEMPLATE',
        position:'FIRST_DOCUMENT_IN_SAC_PACK'
      }, generatedBy, 'SUCCESS', 'Controlled PG-ADM-01 generated from approved master template.');
    } catch (_) {}
    v2InvalidateCache_();

    return {
      ok:true,
      referenceNo:reference,
      fileId:pdfFile.getId(),
      fileName:pdfName,
      url:pdfFile.getUrl(),
      status:'GENERATED',
      version:V2_PG_ADM01_VERSION,
      source:'CONTROLLED_MASTER_TEMPLATE'
    };
  } catch (error) {
    const message = String(error && error.message || error || 'Unknown PG-ADM-01 generation error');
    v2PgAdm01UpdateStatus_(reference, {
      'PG-ADM-01 Status':'FAILED',
      'PG-ADM-01 Error':message,
      'PG-ADM-01 Version':V2_PG_ADM01_VERSION,
      'PG-ADM-01 Source':'CONTROLLED_MASTER_TEMPLATE'
    });
    try {
      v2Audit_(reference, sessionId ? 'SAC' : 'ADMISSION', 'GENERATE_PG_ADM_01', {}, {
        sessionId:String(sessionId || ''),
        error:message,
        version:V2_PG_ADM01_VERSION
      }, generatedBy, 'FAILED', message);
    } catch (_) {}
    v2InvalidateCache_();
    throw error;
  }
}

function v2RegeneratePgAdm01_(data, actor) {
  const reference = String(data && data.referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  const sessionId = String(data && data.sessionId || workflow.record['SAC Session ID'] || '').trim();
  const generated = v2GeneratePgEligibilityPdf_(reference, sessionId, actor || 'Admin Portal V2');

  if (sessionId) {
    const candidate = v2FindComposite_('V2_SAC_CANDIDATES',['SAC Session ID','Reference No'],[sessionId,reference]);
    if (candidate) {
      v2UpdateRow_(candidate.sheet,candidate.rowNumber,{
        'Form 01 URL':generated.url,
        'PG Eligibility Form Version':V2_PG_ADM01_VERSION,
        'Pack Prepared At':''
      });
    }
  }
  return Object.assign({regenerated:true,v1Touched:false},generated);
}

function v2PgAdm01ReplaceField_(body, labelRegex, value) {
  const clean = String(value == null ? '' : value).trim() || '-';
  body.replaceText(labelRegex + '\\s*:\\s*[_ ]+', labelRegex.replace('\\.','.') + ' : ' + clean);
}

function v2PgAdm01TrashMatching_(folder, name) {
  const files = folder.getFilesByName(name);
  while (files.hasNext()) {
    try { files.next().setTrashed(true); } catch (_) {}
  }
}

function v2PgAdm01DisplayDate_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (isNaN(date.getTime())) return text;
  return Utilities.formatDate(date, CONFIG.timezone || 'Asia/Kuala_Lumpur', 'dd MMMM yyyy');
}

function v2PgAdm01ExtractDriveId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/[-\\w]{20,}/);
  return match ? match[0] : '';
}

function v2PgAdm01ParseJson_(value, fallback) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) { return fallback; }
}

function v2PgAdm01Safe_(value) {
  const clean = String(value || '')
    .replace(/[\\\\/:*?"<>|#%{}]/g, ' ')
    .replace(/\\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0,72);
  return clean || 'STUDENT';
}
'''


def patch_main():
    p=Path('api/admin-action.js')
    s=p.read_text(encoding='utf-8')
    if "'v2RegeneratePgAdm01'" not in s:
        s=s.replace("  'v2RunDocumentReview',\n", "  'v2RunDocumentReview',\n  'v2RegeneratePgAdm01',\n", 1)
    p.write_text(s,encoding='utf-8')

    p=Path('admin.html')
    s=p.read_text(encoding='utf-8')
    if 'function pgAdm01Control(r)' not in s:
        marker='    function renderOperationalActions(r){'
        helper=r'''    function pgAdm01Control(r){
      if(!r||r.source==='V1')return '';
      const w=r.workflow||{},status=String(w['PG-ADM-01 Status']||(w['PG-ADM-01 URL']?'GENERATED':'NOT_GENERATED')).toUpperCase();
      const error=String(w['PG-ADM-01 Error']||'').trim();
      const cls=status==='GENERATED'?'green':status==='FAILED'?'red':status==='GENERATING'?'amber':'blue';
      const label=status==='GENERATED'?'PG-ADM-01 Generated':status==='FAILED'?'PG-ADM-01 Failed':status==='GENERATING'?'PG-ADM-01 Generating':'PG-ADM-01 Not Generated';
      const button=status==='GENERATING'?'<button class="ops-btn" disabled>PG-ADM-01 generating…</button>':`<button class="ops-btn" onclick="regeneratePgAdm01()">${status==='GENERATED'?'Regenerate PG-ADM-01':'Generate PG-ADM-01'}</button>`;
      const note=error?`<span class="badge red" title="${esc(error)}">Generation error recorded</span>`:'';
      return `<span class="badge ${cls}">${label}</span>${note}${button}`;
    }
    function regeneratePgAdm01(){
      if(!selected||selected.source==='V1')return;
      runAdminAction('v2RegeneratePgAdm01',{referenceNo:selected.ref},`Regenerate PG-ADM-01 for ${selected.app['Student Name']||selected.ref}? The previous generated copy will be replaced and V1 will remain untouched.`)
    }
'''
        if marker not in s:
            raise SystemExit('renderOperationalActions marker not found')
        s=s.replace(marker,helper+marker,1)

    old='''      el.innerHTML=`<div class="ops-head"><div class="title">Operational Action Center</div><div class="state">${esc(pretty(s))}</div></div><div class="ops-copy">${copy}</div><div class="ops-actions">${actions}</div><div id="opsMessage" class="ops-message"></div>`;\n'''
    new='''      actions=pgAdm01Control(r)+actions;\n      el.innerHTML=`<div class="ops-head"><div class="title">Operational Action Center</div><div class="state">${esc(pretty(s))}</div></div><div class="ops-copy">${copy}</div><div class="ops-actions">${actions}</div><div id="opsMessage" class="ops-message"></div>`;\n'''
    if 'actions=pgAdm01Control(r)+actions;' not in s:
        if old not in s:
            raise SystemExit('Operational Action Center render block not found')
        s=s.replace(old,new,1)

    old_docs="${objectCard('Document review',r.workflow,[['Review Status','Document Review Status'],['Reviewed At','Document Reviewed At'],['Reviewed By','Document Reviewed By'],['Missing Documents','Missing Document Count']],true)}"
    new_docs="${objectCard('Document review',r.workflow,[['Review Status','Document Review Status'],['Reviewed At','Document Reviewed At'],['Reviewed By','Document Reviewed By'],['Missing Documents','Missing Document Count'],['PG-ADM-01','PG-ADM-01 Status'],['PG-ADM-01 Generated','PG-ADM-01 Generated At'],['PG-ADM-01 Error','PG-ADM-01 Error']],true)}"
    if old_docs in s:
        s=s.replace(old_docs,new_docs,1)
    p.write_text(s,encoding='utf-8')


def patch_apps():
    Path('apps-script-v2/PgEligibilityV2.js').write_text(PG_ADM_JS,encoding='utf-8')

    p=Path('apps-script-v2/SacPackV2.js')
    s=p.read_text(encoding='utf-8')
    pattern=r"\nfunction v2GeneratePgEligibilityPdf_\(referenceNo, sessionId, actor\) \{.*?\n\}\n\nfunction v2BuildSacCandidateManifest_"
    s,n=re.subn(pattern,"\nfunction v2BuildSacCandidateManifest_",s,count=1,flags=re.S)
    if n != 1 and 'function v2GeneratePgEligibilityPdf_' in s:
        raise SystemExit(f'Legacy SacPack generator removal count={n}')
    s=s.replace("const V2_PG_ELIGIBILITY_FORM_VERSION = 'PG-ADM-01-V1';","const V2_PG_ELIGIBILITY_FORM_VERSION = 'PG-ADM-01-V2-CONTROLLED';",1)
    if "'Pack Order Verified'" not in s:
        s=s.replace("  'PG Eligibility Form Version'\n];","  'PG Eligibility Form Version',\n  'Pack Order Verified'\n];",1)
    if "'Pack Order Verified':" not in s:
        s=s.replace("      'PG Eligibility Form Version': V2_PG_ELIGIBILITY_FORM_VERSION\n    });","      'PG Eligibility Form Version': V2_PG_ELIGIBILITY_FORM_VERSION,\n      'Pack Order Verified': (manifest.documents[0] && manifest.documents[0].key === 'form01') ? 'YES' : 'NO'\n    });",1)
    p.write_text(s,encoding='utf-8')

    p=Path('apps-script-v2/WorkflowV2.js')
    s=p.read_text(encoding='utf-8')
    wf_section=s.split('V2_WORKFLOW: [',1)[1].split('],',1)[0] if 'V2_WORKFLOW: [' in s else ''
    if 'PG-ADM-01 Status' not in wf_section:
        old="    'Document Review Status','Document Reviewed At','Document Reviewed By','Missing Document Count',\n    'Qualification Screening Status',\n"
        new="    'Document Review Status','Document Reviewed At','Document Reviewed By','Missing Document Count',\n    'PG-ADM-01 Status','PG-ADM-01 URL','PG-ADM-01 Generated At','PG-ADM-01 Error','PG-ADM-01 Version','PG-ADM-01 Source',\n    'Qualification Screening Status',\n"
        if old not in s:
            raise SystemExit('V2_WORKFLOW header insertion marker not found')
        s=s.replace(old,new,1)
    if "action === 'v2RegeneratePgAdm01'" not in s:
        marker="  if (action === 'v2RunDocumentReview') {"
        if marker not in s:
            raise SystemExit('handleV2Post document review marker not found')
        s=s.replace(marker,"  if (action === 'v2RegeneratePgAdm01') return v2RegeneratePgAdm01_(payload.data || {}, payload.updatedBy || 'Admin Portal V2');\n"+marker,1)
    p.write_text(s,encoding='utf-8')


if MODE == 'main':
    patch_main()
elif MODE == 'apps':
    patch_apps()
else:
    raise SystemExit('Usage: stage2-pg-adm01-patch.py [main|apps]')
