/**
 * Admission V2 - Prospect & Registry Activation
 *
 * Standalone operational flow:
 * Applicant -> Consultant/Marketing creates the Prospect in SKYVIALING ->
 * Consultant/Marketing confirms Prospect DONE + selects Fee Group ->
 * Registry processes admission and may later register / activate the student in SKY -> Activation DONE.
 *
 * This module does not depend on Document Review, SAC, Offer, Acceptance or Orientation.
 */

const V2_ACTIVATION_BUILD = 'PROSPECT_SKY_STANDALONE_V3_20260918';
const V2_ACTIVATION_HEADERS = [
  'Fee Structure Status','Fee Structure PDF URL','Fee Structure Updated At',
  'Registry Prospect Notification Status','Registry Prospect Notified At',
  'SKY Activation Status','SKY Student ID','SKY Activated At','SKY Activated By','SKY Activation Remarks'
];

function v2ActivationEnsureFoundation_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  ['V2_APPLICATIONS','V2_WORKFLOW'].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error(name + ' sheet is missing.');
    v2EnsureHeaders_(sheet, V2_ACTIVATION_HEADERS);
  });
  return true;
}

function v2ActivationFeeGroups_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.feeGroupMasterSheetName || 'FEE_GROUP_MASTER');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(v){ return String(v || '').trim(); });
  const idxCode = headers.indexOf('Fee Group Code');
  const idxFile = headers.indexOf('File ID PDF');
  const idxActive = headers.indexOf('Active');
  if (idxCode < 0) return [];
  const seen = {};
  return values.slice(1).map(function(row) {
    const code = String(row[idxCode] || '').trim();
    if (!code || seen[code]) return null;
    if (idxActive > -1) {
      const active = String(row[idxActive] || '').trim().toUpperCase();
      if (active && ['ACTIVE','YES','TRUE','1'].indexOf(active) < 0) return null;
    }
    seen[code] = true;
    return {
      code: code,
      fileId: idxFile > -1 ? String(row[idxFile] || '').trim() : ''
    };
  }).filter(Boolean);
}

function v2ActivationResolveFeeStructure_(feeGroup) {
  const code = String(feeGroup || '').trim();
  if (!code) return {status:'NOT_SELECTED', feeGroup:'', fileId:'', url:''};
  const row = v2ActivationFeeGroups_().filter(function(x){ return x.code === code; })[0];
  if (!row) throw new Error('Fee Group is not available in FEE_GROUP_MASTER.');
  if (!row.fileId) return {status:'TEMPLATE_MISSING', feeGroup:code, fileId:'', url:''};
  try {
    const file = DriveApp.getFileById(row.fileId);
    return {status:'READY', feeGroup:code, fileId:row.fileId, url:file.getUrl(), name:file.getName()};
  } catch (error) {
    return {status:'FILE_UNAVAILABLE', feeGroup:code, fileId:row.fileId, url:''};
  }
}

function v2ActivationAdminUrl_(reference) {
  const props = PropertiesService.getScriptProperties();
  const base = String(
    props.getProperty('V2_ADMIN_PORTAL_URL') ||
    'https://ipgs-admission-form.innovative.edu.my/admin.html'
  ).trim();
  const joiner = base.indexOf('?') === -1 ? '?' : '&';
  return base + joiner + 'section=activation&ref=' + encodeURIComponent(String(reference || ''));
}

function v2ActivationSyncFeeStructure_(reference, feeGroup, actor) {
  v2ActivationEnsureFoundation_();
  const resolved = v2ActivationResolveFeeStructure_(feeGroup);
  const now = new Date().toISOString();
  const patch = {
    'Fee Structure Status': resolved.status,
    'Fee Structure PDF URL': resolved.url || '',
    'Fee Structure Updated At': now,
    'Last Updated': now
  };
  const app = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (app) v2UpdateRow_(app.sheet,app.rowNumber,patch);
  if (workflow) {
    patch['Updated By'] = actor || 'Prospect / Activation';
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,patch);
  }
  return resolved;
}

function v2NotifyRegistryProspectReady_(reference, actor) {
  v2ActivationEnsureFoundation_();
  const app = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!app || !workflow) throw new Error('Application/workflow record not found.');

  const prospectStatus = String(workflow.record['Prospect Status'] || '').toUpperCase();
  const skyProspectId = String(workflow.record['SKY Prospect ID'] || '').trim();
  const feeGroup = String(workflow.record['Fee Group'] || '').trim();
  if (['PROSPECT_COMPLETED','PROSPECT_UPDATED'].indexOf(prospectStatus) < 0 || !feeGroup) {
    throw new Error('Registry notification blocked: Marketing Prospect completion and Fee Group are incomplete.');
  }

  const fee = v2ActivationSyncFeeStructure_(reference, feeGroup, actor || 'Prospect Update');
  const refreshedApp = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const refreshedWorkflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  const a = refreshedApp.record;
  const w = refreshedWorkflow.record;
  const recipients = v2NotificationAdminRecipients_();
  const adminUrl = v2ActivationAdminUrl_(reference);
  const agentLabel = [a['Agent Code'],a['Agent Name']].filter(Boolean).join(' - ') || 'Direct / Registry';
  const feeLink = fee.url
    ? '<p><a href="'+v2Html_(fee.url)+'" style="color:#2d2363;font-weight:700">Open Fee Structure PDF</a></p>'
    : '<p style="color:#8a5b00"><strong>Fee Structure template:</strong> '+v2Html_(fee.status)+'. Registry may continue reviewing the prospect, but the master PDF should be configured.</p>';

  const subject = '[REGISTRY ACTION] Prospect Ready - ' + String(a['Student Name'] || reference);
  const html = '<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
    '<div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Prospect Ready for Registry Review</h2></div>' +
    '<div style="padding:24px"><p>Marketing / Academic Consultant has confirmed that the SKYVIALING Prospect is completed and the Fee Group has been selected.</p>' +
    '<p><strong>Student:</strong> '+v2Html_(a['Student Name'])+
    '<br><strong>ID / Passport:</strong> '+v2Html_(a['ID / Passport No'])+
    '<br><strong>Personal Email:</strong> '+v2Html_(a['Personal Email'])+
    '<br><strong>Phone:</strong> '+v2Html_(a['Phone Number'])+
    '<br><strong>Programme:</strong> '+v2Html_(a['Programme'])+
    '<br><strong>Intake:</strong> '+v2Html_(a['Intake'])+
    '<br><strong>Academic Consultant:</strong> '+v2Html_(agentLabel)+
    (skyProspectId ? '<br><strong>SKY Prospect ID:</strong> '+v2Html_(skyProspectId) : '')+
    '<br><strong>Fee Group:</strong> '+v2Html_(feeGroup)+'</p>' +
    feeLink +
    '<div style="text-align:center;margin:24px 0"><a href="'+v2Html_(adminUrl)+'" style="display:inline-block;background:#2d2363;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:bold">Open Registry Activation</a></div>' +
    '<p style="font-size:12px;color:#697386">Prospect completion is an operational Marketing handoff. Registry may proceed with SKY registration/activation independently of the admission workflow.</p>' +
    '<p>Regards,<br><strong>IPGS Admission V2</strong></p></div></div>';

  const delivery = v2NotificationSend_(
    'REGISTRY_PROSPECT_READY',
    recipients,
    subject,
    'Prospect completed by Marketing: ' + String(a['Student Name'] || '') + ' / ' + reference + ' / Fee Group ' + feeGroup + '\nRegistry: ' + adminUrl,
    html,
    {}
  );

  const now = new Date().toISOString();
  const update = {
    'Registry Prospect Notification Status': delivery.status,
    'Registry Prospect Notified At': delivery.sent ? now : '',
    'Last Updated': now
  };
  v2UpdateRow_(refreshedApp.sheet,refreshedApp.rowNumber,update);
  update['Updated By'] = actor || 'Prospect Update';
  v2UpdateRow_(refreshedWorkflow.sheet,refreshedWorkflow.rowNumber,update);

  v2Audit_(reference,'PROSPECT','REGISTRY_NOTIFIED',{},{
    skyProspectId:skyProspectId,
    feeGroup:feeGroup,
    feeStructureStatus:fee.status,
    notificationStatus:delivery.status
  },actor || 'Prospect Update',delivery.sent ? 'SUCCESS' : 'SKIPPED','Registry notified after prospect completion.');
  v2InvalidateCache_();
  return {ok:true,referenceNo:reference,status:delivery.status,sent:delivery.sent,feeStructure:fee,adminUrl:adminUrl};
}

function v2RegistryUpsertProspect_(data, actor) {
  v2ActivationEnsureFoundation_();
  const reference = v2Required_(data.referenceNo,'Reference No');
  const feeGroup = v2Required_(data.feeGroup,'Fee Group');
  const remarks = String(data.remarks || '').trim();

  const validFee = v2ActivationFeeGroups_().some(function(x){ return x.code === feeGroup; });
  if (!validFee) throw new Error('Select a valid Fee Group from FEE_GROUP_MASTER.');

  const app = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!app || !workflow) throw new Error('Application/workflow record not found.');

  const existingStatus = String(
    workflow.record['Prospect Status'] ||
    app.record['Prospect Status'] ||
    'PROSPECT_COMPLETED'
  ).trim() || 'PROSPECT_COMPLETED';

  if (['PROSPECT_COMPLETED','PROSPECT_UPDATED'].indexOf(existingStatus.toUpperCase()) < 0) {
    throw new Error('Fee Group correction is only available after Marketing has completed the Prospect step.');
  }

  const previousFeeGroup = String(
    workflow.record['Fee Group'] ||
    app.record['Fee Group'] ||
    ''
  ).trim();

  const now = new Date().toISOString();
  const patch = {
    'Prospect Status': existingStatus,
    'Fee Group': feeGroup,
    'Prospect Updated At': now,
    'Prospect Remarks': remarks,
    'Last Updated': now
  };

  v2UpdateRow_(app.sheet,app.rowNumber,patch);
  v2UpdateRow_(workflow.sheet,workflow.rowNumber,Object.assign({},patch,{
    'Updated By': actor || 'Registry Admin'
  }));

  const fee = v2ActivationSyncFeeStructure_(reference,feeGroup,actor || 'Registry Admin');

  v2Audit_(reference,'PROSPECT','REGISTRY_FEE_GROUP_CORRECTED',{
    feeGroup:previousFeeGroup
  },{
    feeGroup:feeGroup,
    feeStructureStatus:fee.status,
    prospectStatus:existingStatus
  },actor || 'Registry Admin','SUCCESS',remarks);

  v2InvalidateCache_();
  return {
    ok:true,
    referenceNo:reference,
    prospectStatus:existingStatus,
    feeGroup:feeGroup,
    previousFeeGroup:previousFeeGroup,
    feeStructure:fee,
    activationReady:v2ActivationReadiness_(reference)
  };
}

function v2RefreshFeeStructure_(data, actor) {
  const reference = v2Required_(data.referenceNo,'Reference No');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('Workflow record not found.');
  const feeGroup = v2Required_(workflow.record['Fee Group'],'Fee Group');
  const result = v2ActivationSyncFeeStructure_(reference,feeGroup,actor || 'Registry Admin');
  v2Audit_(reference,'PROSPECT','REFRESH_FEE_STRUCTURE',{},result,actor || 'Registry Admin','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true,referenceNo:reference,feeStructure:result};
}

function v2ActivationReadiness_(reference) {
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  if (!workflow && !application) throw new Error('Application record not found.');
  const w = workflow ? workflow.record : application.record;
  const reasons = [];
  const prospectStatus = String(w['Prospect Status'] || '').toUpperCase();
  if (['PROSPECT_COMPLETED','PROSPECT_UPDATED'].indexOf(prospectStatus) < 0) reasons.push('Marketing has not confirmed Prospect completion');
  if (!String(w['Fee Group'] || '').trim()) reasons.push('Fee Group missing');
  if (String(w['SKY Activation Status'] || '').toUpperCase() === 'ACTIVATED') reasons.push('Already activated');
  return {
    ready: reasons.length === 0,
    reasons: reasons,
    prospectStatus:String(w['Prospect Status'] || ''),
    skyActivationStatus:String(w['SKY Activation Status'] || 'NOT_ACTIVATED'),
    standalone:true
  };
}

function v2ActivateStudentInSky_(data, actor) {
  v2ActivationEnsureFoundation_();
  const reference = v2Required_(data.referenceNo,'Reference No');
  const skyStudentId = String(data.skyStudentId || '').trim();
  const remarks = String(data.remarks || '').trim();

  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  const app = v2Find_('V2_APPLICATIONS','Reference No',reference);
  if (!workflow || !app) throw new Error('Application/workflow record not found.');

  const current = String(workflow.record['SKY Activation Status'] || '').toUpperCase();
  if (current === 'ACTIVATED') {
    return {
      ok:true,alreadyActivated:true,referenceNo:reference,
      skyStudentId:workflow.record['SKY Student ID'] || '',
      activatedAt:workflow.record['SKY Activated At'] || '',
      activatedBy:workflow.record['SKY Activated By'] || ''
    };
  }

  const readiness = v2ActivationReadiness_(reference);
  if (!readiness.ready) {
    throw new Error('SKY activation blocked: ' + readiness.reasons.join('; ') + '.');
  }

  const now = new Date().toISOString();
  const patch = {
    'SKY Activation Status':'ACTIVATED',
    'SKY Student ID':skyStudentId,
    'SKY Activated At':now,
    'SKY Activated By':actor || 'Registry Admin',
    'SKY Activation Remarks':remarks,
    'Last Updated':now
  };
  v2UpdateRow_(app.sheet,app.rowNumber,patch);
  if (workflow) {
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,Object.assign({},patch,{
      'Updated By':actor || 'Registry Admin'
    }));
  }

  v2Audit_(reference,'ACTIVATION','SKY_ACTIVATED',{},{
    skyStudentId:skyStudentId,
    prospectId:workflow.record['SKY Prospect ID'] || '',
    feeGroup:workflow.record['Fee Group'] || '',
    activationStatus:'ACTIVATED',
    standalone:true
  },actor || 'Registry Admin','SUCCESS',remarks);
  v2InvalidateCache_();

  return {
    ok:true,referenceNo:reference,skyStudentId:skyStudentId,
    skyActivationStatus:'ACTIVATED',activatedAt:now,activatedBy:actor || 'Registry Admin',
    standalone:true,build:V2_ACTIVATION_BUILD
  };
}
