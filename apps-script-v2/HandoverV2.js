/**
 * Admission V2 - Stage 5 Academic Handover & Provisioning
 *
 * Flow:
 * Orientation ATTENDED -> create handover batch -> email Academic ->
 * Academic accepts secure handover -> notify IT/Moodle/Library ->
 * Registry tracks provisioning completion -> student access email -> ACTIVE_STUDENT.
 */

const V2_HANDOVER_BUILD = 'ACADEMIC_HANDOVER_V2_STAGE5_ACCESS_NOTIFY_20260918';

const V2_HANDOVER_BATCH_HEADERS = [
  'Handover Batch ID','Handover Name','Status','Student Count','Intake Summary',
  'Academic Email','IT PIC Email','Moodle PIC Email','E-Library PIC Email',
  'Handover PDF URL','Academic Accept Token Hash','Academic Accept URL',
  'Academic Email Status','Academic Email Sent At',
  'Accepted At','Accepted By','Provisioning Tasks Sent At',
  'Created At','Created By','Updated At'
];

const V2_HANDOVER_STUDENT_HEADERS = [
  'Handover Batch ID','Reference No','Student Name','ID / Passport No',
  'Personal Email','Programme','Intake','Orientation Session ID','Orientation Status',
  'Handover Status','Accepted At','Provisioning Status','Last Updated'
];

const V2_HANDOVER_PROVISIONING_EXTRA_HEADERS = [
  'Handover Batch ID',
  'IT Task Email Status','IT Task Email Sent At',
  'Moodle Task Email Status','Moodle Task Email Sent At',
  'E-Library Task Email Status','E-Library Task Email Sent At'
];

function v2HandoverEnsureFoundation_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const defs = [
    ['V2_HANDOVER_BATCHES', V2_HANDOVER_BATCH_HEADERS],
    ['V2_HANDOVER_STUDENTS', V2_HANDOVER_STUDENT_HEADERS]
  ];
  defs.forEach(function(def) {
    let sheet = ss.getSheetByName(def[0]);
    if (!sheet) sheet = ss.insertSheet(def[0]);
    v2EnsureHeaders_(sheet, def[1]);
    v2StyleHeader_(sheet, sheet.getLastColumn());
  });
  const provisioning = ss.getSheetByName('V2_PROVISIONING');
  if (!provisioning) throw new Error('V2_PROVISIONING sheet is missing.');
  v2EnsureHeaders_(provisioning, V2_HANDOVER_PROVISIONING_EXTRA_HEADERS);
  return true;
}

function v2CreateHandoverSession_(data, actor) {
  v2HandoverEnsureFoundation_();
  const name = String(data.name || '').trim() || ('Academic Handover - ' + Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'dd MMM yyyy'));
  const academicEmail = v2HandoverEmail_(data.academicEmail, 'Academic email');
  const itEmail = v2HandoverEmail_(data.itEmail, 'IT PIC email');
  const moodleEmail = v2HandoverEmail_(data.moodleEmail, 'Moodle PIC email');
  const libraryEmail = v2HandoverEmail_(data.libraryEmail, 'E-Library PIC email');
  const now = new Date().toISOString();
  const batchId = 'HND-' + Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0,6).toUpperCase();

  v2Append_('V2_HANDOVER_BATCHES',{
    'Handover Batch ID':batchId,
    'Handover Name':name,
    'Status':'DRAFT',
    'Student Count':0,
    'Intake Summary':'',
    'Academic Email':academicEmail,
    'IT PIC Email':itEmail,
    'Moodle PIC Email':moodleEmail,
    'E-Library PIC Email':libraryEmail,
    'Handover PDF URL':'',
    'Academic Accept Token Hash':'',
    'Academic Accept URL':'',
    'Academic Email Status':'NOT_SENT',
    'Academic Email Sent At':'',
    'Accepted At':'',
    'Accepted By':'',
    'Provisioning Tasks Sent At':'',
    'Created At':now,
    'Created By':actor || 'Admin Portal V2',
    'Updated At':now
  });

  v2Audit_('', 'ACADEMIC_HANDOVER', 'CREATE_HANDOVER_SESSION', {}, {
    batchId:batchId,name:name,standalone:true
  }, actor || 'Admin Portal V2', 'SUCCESS', 'Standalone handover session created.');
  v2InvalidateCache_();
  return {ok:true,batchId:batchId,status:'DRAFT',name:name,standalone:true};
}

function v2AddHandoverStudents_(data, actor) {
  v2HandoverEnsureFoundation_();
  const batchId = v2Required_(data.batchId,'Handover Batch ID');
  const batch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (!batch) throw new Error('Handover session not found.');
  if (String(batch.record['Status'] || '').toUpperCase() !== 'DRAFT') {
    throw new Error('Students can only be added while the Handover Session is in DRAFT.');
  }

  const references = Array.from(new Set((data.referenceNos || []).map(function(v){
    return String(v || '').trim();
  }).filter(Boolean)));
  if (!references.length) throw new Error('Select at least one student.');

  const used = {};
  v2Rows_('V2_HANDOVER_STUDENTS').forEach(function(row){
    const ref = String(row['Reference No'] || '').trim();
    if (ref) used[ref] = String(row['Handover Batch ID'] || '');
  });

  const now = new Date().toISOString();
  const added = [];
  const skipped = [];

  references.forEach(function(reference){
    if (used[reference]) {
      skipped.push({referenceNo:reference,batchId:used[reference]});
      return;
    }

    const app = v2Find_('V2_APPLICATIONS','Reference No',reference);
    const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
    if (!app) throw new Error('Application not found for ' + reference + '.');

    v2Append_('V2_HANDOVER_STUDENTS',{
      'Handover Batch ID':batchId,
      'Reference No':reference,
      'Student Name':String((workflow && workflow.record['Student Name']) || app.record['Student Name'] || ''),
      'ID / Passport No':String((workflow && workflow.record['ID / Passport No']) || app.record['ID / Passport No'] || ''),
      'Personal Email':String(app.record['Personal Email'] || (workflow && workflow.record['Personal Email']) || ''),
      'Programme':String((workflow && workflow.record['Programme']) || app.record['Programme'] || ''),
      'Intake':String(app.record['Intake'] || (workflow && workflow.record['Intake']) || ''),
      'Orientation Session ID':String((workflow && workflow.record['Orientation Session ID']) || ''),
      'Orientation Status':String((workflow && workflow.record['Orientation Status']) || ''),
      'Handover Status':'DRAFT',
      'Accepted At':'',
      'Provisioning Status':'NOT_STARTED',
      'Last Updated':now
    });
    used[reference]=batchId;
    added.push(reference);
  });

  const students=v2HandoverStudents_(batchId);
  const intakes=Array.from(new Set(students.map(function(s){return String(s['Intake']||'').trim();}).filter(Boolean)));
  v2UpdateRow_(batch.sheet,batch.rowNumber,{
    'Student Count':students.length,
    'Intake Summary':intakes.join(', '),
    'Updated At':now
  });

  v2Audit_('', 'ACADEMIC_HANDOVER', 'ADD_HANDOVER_STUDENTS', {}, {
    batchId:batchId,added:added,skipped:skipped
  }, actor || 'Admin Portal V2', 'SUCCESS', '');
  v2InvalidateCache_();
  return {ok:true,batchId:batchId,addedCount:added.length,studentCount:students.length,skipped:skipped};
}

function v2SendHandoverSession_(data, actor) {
  v2HandoverEnsureFoundation_();
  const batchId=v2Required_(data.batchId,'Handover Batch ID');
  const batch=v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if(!batch) throw new Error('Handover session not found.');
  if(String(batch.record['Status']||'').toUpperCase()!=='DRAFT') {
    throw new Error('This Handover Session has already been sent.');
  }

  const students=v2HandoverStudents_(batchId);
  if(!students.length) throw new Error('Add at least one student before Handover.');

  const normalized=students.map(function(s){
    return {
      referenceNo:String(s['Reference No']||''),
      studentName:String(s['Student Name']||''),
      idPassport:String(s['ID / Passport No']||''),
      personalEmail:String(s['Personal Email']||''),
      programme:String(s['Programme']||''),
      intake:String(s['Intake']||''),
      orientationSessionId:String(s['Orientation Session ID']||''),
      orientationStatus:String(s['Orientation Status']||'')
    };
  });

  const now=new Date().toISOString();
  const pdf=v2HandoverGeneratePdf_(batchId,String(batch.record['Handover Name']||batchId),normalized,actor||'Admin Portal V2');

  students.forEach(function(student){
    const reference=String(student['Reference No']||'');
    const row=v2FindComposite_('V2_HANDOVER_STUDENTS',['Handover Batch ID','Reference No'],[batchId,reference]);
    if(row) v2UpdateRow_(row.sheet,row.rowNumber,{
      'Handover Status':'HANDED_OVER',
      'Provisioning Status':'IN_PROGRESS',
      'Last Updated':now
    });

    const existing=v2Find_('V2_PROVISIONING','Reference No',reference);
    const old=existing?existing.record:{};
    v2Upsert_('V2_PROVISIONING','Reference No',reference,{
      'Reference No':reference,
      'Handover Batch ID':batchId,
      'Student Name':student['Student Name'],
      'ID / Passport No':student['ID / Passport No'],
      'Personal Email':student['Personal Email'],
      'Innovative Email':old['Innovative Email']||'',
      'IT Email Status':old['IT Email Status']||'PENDING',
      'IT Completed At':old['IT Completed At']||'',
      'IT Completed By':old['IT Completed By']||'',
      'E-Library Status':old['E-Library Status']||'PENDING',
      'E-Library Completed At':old['E-Library Completed At']||'',
      'E-Library Completed By':old['E-Library Completed By']||'',
      'Moodle Status':old['Moodle Status']||'PENDING',
      'Moodle Login Email':old['Moodle Login Email']||student['Personal Email'],
      'Moodle Completed At':old['Moodle Completed At']||'',
      'Moodle Completed By':old['Moodle Completed By']||'',
      'Student Notification Status':old['Student Notification Status']||'NOT_READY',
      'Student Notified At':old['Student Notified At']||'',
      'IT Task Email Status':'PENDING',
      'IT Task Email Sent At':'',
      'Moodle Task Email Status':'PENDING',
      'Moodle Task Email Sent At':'',
      'E-Library Task Email Status':'PENDING',
      'E-Library Task Email Sent At':'',
      'Last Updated':now,
      'Remarks':old['Remarks']||''
    });

    const workflow=v2Find_('V2_WORKFLOW','Reference No',reference);
    if(workflow) v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
      'Academic Handover Status':'HANDED_OVER',
      'Provisioning Status':'IN_PROGRESS',
      'Last Updated':now,
      'Updated By':actor||'Admin Portal V2'
    });
  });

  const currentStudents=v2HandoverStudents_(batchId);
  const batchRecord=Object.assign({},batch.record,{'Handover PDF URL':pdf.url,'Status':'HANDED_OVER'});
  const academic=v2HandoverSendAcademicEmail_(batchRecord,currentStudents,pdf.fileId,false);
  const tasks=v2HandoverSendProvisioningTasks_(batchRecord,currentStudents);

  v2UpdateRow_(batch.sheet,batch.rowNumber,{
    'Status':'HANDED_OVER',
    'Handover PDF URL':pdf.url,
    'Academic Email Status':academic.status,
    'Academic Email Sent At':academic.sent?new Date().toISOString():'',
    'Provisioning Tasks Sent At':tasks.anySent?new Date().toISOString():'',
    'Updated At':new Date().toISOString()
  });

  v2Audit_('', 'ACADEMIC_HANDOVER', 'SEND_HANDOVER_SESSION', {}, {
    batchId:batchId,studentCount:students.length,academicEmailStatus:academic.status,provisioningTasks:tasks
  }, actor || 'Admin Portal V2', 'SUCCESS', 'Handover sent directly to Academic and service PICs.');
  v2InvalidateCache_();

  return {
    ok:true,batchId:batchId,status:'HANDED_OVER',studentCount:students.length,
    academicEmailStatus:academic.status,provisioningTasks:tasks,pdfUrl:pdf.url,standalone:true
  };
}

function v2CreateAcademicHandoverBatch_(data, actor) {
  v2HandoverEnsureFoundation_();

  const references = Array.from(new Set((data.referenceNos || []).map(function(v){
    return String(v || '').trim();
  }).filter(Boolean)));
  if (!references.length) throw new Error('Select at least one student for Academic Handover.');
  if (references.length > 100) throw new Error('Create a maximum of 100 students per handover batch.');

  const academicEmail = v2HandoverEmail_(data.academicEmail, 'Academic email');
  const itEmail = v2HandoverEmail_(data.itEmail, 'IT PIC email');
  const moodleEmail = v2HandoverEmail_(data.moodleEmail, 'Moodle PIC email');
  const libraryEmail = v2HandoverEmail_(data.libraryEmail, 'E-Library PIC email');
  const name = String(data.name || '').trim() || ('Academic Handover - ' + Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'dd MMM yyyy'));
  const now = new Date().toISOString();

  // Standalone module: Applications are the source list only.
  // Admission progress, Orientation, SAC, Offer and SKY statuses do not gate Handover.
  const alreadyHandedOver = {};
  v2Rows_('V2_HANDOVER_STUDENTS').forEach(function(row) {
    const ref = String(row['Reference No'] || '').trim();
    if (ref) alreadyHandedOver[ref] = String(row['Handover Batch ID'] || '');
  });

  const students = references.map(function(reference) {
    if (alreadyHandedOver[reference]) {
      throw new Error('Student ' + reference + ' is already included in Handover Batch ' + alreadyHandedOver[reference] + '.');
    }

    const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
    const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
    if (!application) throw new Error('Application not found for ' + reference + '.');

    return {
      referenceNo:reference,
      studentName:String((workflow && workflow.record['Student Name']) || application.record['Student Name'] || ''),
      idPassport:String((workflow && workflow.record['ID / Passport No']) || application.record['ID / Passport No'] || ''),
      personalEmail:String(application.record['Personal Email'] || (workflow && workflow.record['Personal Email']) || ''),
      programme:String((workflow && workflow.record['Programme']) || application.record['Programme'] || ''),
      intake:String(application.record['Intake'] || (workflow && workflow.record['Intake']) || ''),
      orientationSessionId:String((workflow && workflow.record['Orientation Session ID']) || ''),
      orientationStatus:String((workflow && workflow.record['Orientation Status']) || '')
    };
  });

  const batchId = 'HND-' + Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0,6).toUpperCase();
  const pdf = v2HandoverGeneratePdf_(batchId, name, students, actor || 'Admin Portal V2');
  const intakeValues = Array.from(new Set(students.map(function(s){return s.intake;}).filter(Boolean)));

  const row = {
    'Handover Batch ID':batchId,
    'Handover Name':name,
    'Status':'HANDED_OVER',
    'Student Count':students.length,
    'Intake Summary':intakeValues.join(', '),
    'Academic Email':academicEmail,
    'IT PIC Email':itEmail,
    'Moodle PIC Email':moodleEmail,
    'E-Library PIC Email':libraryEmail,
    'Handover PDF URL':pdf.url,
    'Academic Accept Token Hash':'',
    'Academic Accept URL':'',
    'Academic Email Status':'PENDING',
    'Academic Email Sent At':'',
    'Accepted At':'',
    'Accepted By':'',
    'Provisioning Tasks Sent At':'',
    'Created At':now,
    'Created By':actor || 'Admin Portal V2',
    'Updated At':now
  };
  v2Append_('V2_HANDOVER_BATCHES',row);

  students.forEach(function(student) {
    v2Append_('V2_HANDOVER_STUDENTS',{
      'Handover Batch ID':batchId,
      'Reference No':student.referenceNo,
      'Student Name':student.studentName,
      'ID / Passport No':student.idPassport,
      'Personal Email':student.personalEmail,
      'Programme':student.programme,
      'Intake':student.intake,
      'Orientation Session ID':student.orientationSessionId,
      'Orientation Status':student.orientationStatus,
      'Handover Status':'HANDED_OVER',
      'Accepted At':'',
      'Provisioning Status':'IN_PROGRESS',
      'Last Updated':now
    });

    const existing = v2Find_('V2_PROVISIONING','Reference No',student.referenceNo);
    const old = existing ? existing.record : {};
    v2Upsert_('V2_PROVISIONING','Reference No',student.referenceNo,{
      'Reference No':student.referenceNo,
      'Handover Batch ID':batchId,
      'Student Name':student.studentName,
      'ID / Passport No':student.idPassport,
      'Personal Email':student.personalEmail,
      'Innovative Email':old['Innovative Email'] || '',
      'IT Email Status':old['IT Email Status'] || 'PENDING',
      'IT Completed At':old['IT Completed At'] || '',
      'IT Completed By':old['IT Completed By'] || '',
      'E-Library Status':old['E-Library Status'] || 'PENDING',
      'E-Library Completed At':old['E-Library Completed At'] || '',
      'E-Library Completed By':old['E-Library Completed By'] || '',
      'Moodle Status':old['Moodle Status'] || 'PENDING',
      'Moodle Login Email':old['Moodle Login Email'] || student.personalEmail,
      'Moodle Completed At':old['Moodle Completed At'] || '',
      'Moodle Completed By':old['Moodle Completed By'] || '',
      'Student Notification Status':old['Student Notification Status'] || 'NOT_READY',
      'Student Notified At':old['Student Notified At'] || '',
      'IT Task Email Status':'PENDING',
      'IT Task Email Sent At':'',
      'Moodle Task Email Status':'PENDING',
      'Moodle Task Email Sent At':'',
      'E-Library Task Email Status':'PENDING',
      'E-Library Task Email Sent At':'',
      'Last Updated':now,
      'Remarks':old['Remarks'] || ''
    });

    const workflow = v2Find_('V2_WORKFLOW','Reference No',student.referenceNo);
    if (workflow) {
      v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
        'Academic Handover Status':'HANDED_OVER',
        'Provisioning Status':'IN_PROGRESS',
        'Last Updated':now,
        'Updated By':actor || 'Admin Portal V2'
      });
    }
  });

  const handoverStudents = v2HandoverStudents_(batchId);
  const emailResult = v2HandoverSendAcademicEmail_(row, handoverStudents, pdf.fileId, false);
  const taskResult = v2HandoverSendProvisioningTasks_(row, handoverStudents);

  const batch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (batch) {
    v2UpdateRow_(batch.sheet,batch.rowNumber,{
      'Academic Email Status':emailResult.status,
      'Academic Email Sent At':emailResult.sent ? new Date().toISOString() : '',
      'Provisioning Tasks Sent At':taskResult.anySent ? new Date().toISOString() : '',
      'Updated At':new Date().toISOString()
    });
  }

  v2Audit_('', 'ACADEMIC_HANDOVER', 'CREATE_HANDOVER_BATCH', {}, {
    batchId:batchId,
    studentCount:students.length,
    academicEmailStatus:emailResult.status,
    provisioningTaskStatus:taskResult,
    pdfUrl:pdf.url,
    standalone:true
  }, actor || 'Admin Portal V2', 'SUCCESS', 'Standalone handover batch sent directly to Academic and provisioning PICs.');

  v2InvalidateCache_();
  return {
    ok:true,
    batchId:batchId,
    status:'HANDED_OVER',
    studentCount:students.length,
    pdfUrl:pdf.url,
    academicEmailStatus:emailResult.status,
    provisioningTasks:taskResult,
    standalone:true,
    build:V2_HANDOVER_BUILD
  };
}
function v2ResendAcademicHandoverEmail_(data, actor) {
  v2HandoverEnsureFoundation_();
  const batchId = v2Required_(data.batchId,'Handover Batch ID');
  const batch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (!batch) throw new Error('Academic Handover batch not found.');
  const students = v2HandoverStudents_(batchId);
  const pdfId = v2HandoverExtractDriveId_(batch.record['Handover PDF URL']);
  if (!pdfId) throw new Error('Handover PDF cannot be resolved.');
  const result = v2HandoverSendAcademicEmail_(batch.record, students, pdfId, true);
  v2UpdateRow_(batch.sheet,batch.rowNumber,{
    'Academic Email Status':result.status,
    'Academic Email Sent At':result.sent ? new Date().toISOString() : '',
    'Updated At':new Date().toISOString()
  });
  v2Audit_('', 'ACADEMIC_HANDOVER', 'RESEND_ACADEMIC_HANDOVER_EMAIL', {}, {
    batchId:batchId,status:result.status
  }, actor || 'Admin Portal V2', result.sent ? 'SUCCESS' : 'SKIPPED', '');
  v2InvalidateCache_();
  return {ok:true,batchId:batchId,status:result.status,sent:result.sent};
}

function v2RenderAcademicHandoverPage_(params) {
  const template = HtmlService.createTemplateFromFile('academic-handover-v2');
  template.token = String(params && params.token || '');
  return template.evaluate().setTitle('IUC IPGS Academic Handover');
}

function v2AcademicHandoverPageData(token) {
  v2HandoverEnsureFoundation_();
  const resolved = v2HandoverResolveToken_(token);
  if (!resolved) return {ok:false,message:'This Academic Handover link is invalid or no longer available.'};
  const students = v2HandoverStudents_(resolved.record['Handover Batch ID']);
  return {
    ok:true,
    batch:{
      batchId:resolved.record['Handover Batch ID'],
      name:resolved.record['Handover Name'],
      status:resolved.record['Status'],
      studentCount:Number(resolved.record['Student Count'] || students.length),
      intakeSummary:resolved.record['Intake Summary'],
      pdfUrl:resolved.record['Handover PDF URL'],
      createdAt:resolved.record['Created At'],
      acceptedAt:resolved.record['Accepted At'],
      acceptedBy:resolved.record['Accepted By']
    },
    students:students.map(function(s){
      return {
        referenceNo:s['Reference No'],
        studentName:s['Student Name'],
        idPassport:s['ID / Passport No'],
        programme:s['Programme'],
        intake:s['Intake'],
        orientationStatus:s['Orientation Status']
      };
    })
  };
}

function v2AcademicHandoverAccept(token, acceptedBy) {
  v2HandoverEnsureFoundation_();
  const resolved = v2HandoverResolveToken_(token);
  if (!resolved) throw new Error('This Academic Handover link is invalid or expired.');
  const batch = resolved.record;
  const batchId = String(batch['Handover Batch ID'] || '');
  const currentStatus = String(batch['Status'] || '').toUpperCase();
  if (currentStatus === 'ACCEPTED') {
    return {ok:true,alreadyAccepted:true,batchId:batchId,acceptedAt:batch['Accepted At'],acceptedBy:batch['Accepted By']};
  }
  if (currentStatus !== 'PENDING_ACADEMIC_ACCEPTANCE') {
    throw new Error('This Academic Handover batch is not awaiting acceptance.');
  }

  const acceptor = String(acceptedBy || '').trim();
  if (!acceptor) throw new Error('Please enter the Academic representative name before accepting.');
  const students = v2HandoverStudents_(batchId);
  if (!students.length) throw new Error('No students found in this Academic Handover batch.');

  const now = new Date().toISOString();
  const batchRow = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  v2UpdateRow_(batchRow.sheet,batchRow.rowNumber,{
    'Status':'ACCEPTED',
    'Accepted At':now,
    'Accepted By':acceptor,
    'Updated At':now
  });

  students.forEach(function(student) {
    const reference = student['Reference No'];
    const row = v2FindComposite_(
      'V2_HANDOVER_STUDENTS',
      ['Handover Batch ID','Reference No'],
      [batchId,reference]
    );
    if (row) {
      v2UpdateRow_(row.sheet,row.rowNumber,{
        'Handover Status':'HANDED_OVER',
        'Accepted At':now,
        'Provisioning Status':'IN_PROGRESS',
        'Last Updated':now
      });
    }

    const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
    if (workflow) {
      v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
        'Academic Handover Status':'ACCEPTED',
        'Provisioning Status':'IN_PROGRESS',
        'Application Stage':'ACADEMIC_HANDOVER',
        'Last Updated':now,
        'Updated By':'Academic Acceptance'
      });
    }

    const existing = v2Find_('V2_PROVISIONING','Reference No',reference);
    const old = existing ? existing.record : {};
    const provisioning = {
      'Reference No':reference,
      'Handover Batch ID':batchId,
      'Student Name':student['Student Name'],
      'ID / Passport No':student['ID / Passport No'],
      'Personal Email':student['Personal Email'],
      'Innovative Email':old['Innovative Email'] || '',
      'IT Email Status':old['IT Email Status'] || 'PENDING',
      'IT Completed At':old['IT Completed At'] || '',
      'IT Completed By':old['IT Completed By'] || '',
      'E-Library Status':old['E-Library Status'] || 'PENDING',
      'E-Library Completed At':old['E-Library Completed At'] || '',
      'E-Library Completed By':old['E-Library Completed By'] || '',
      'Moodle Status':old['Moodle Status'] || 'PENDING',
      'Moodle Login Email':student['Personal Email'],
      'Moodle Completed At':old['Moodle Completed At'] || '',
      'Moodle Completed By':old['Moodle Completed By'] || '',
      'Student Notification Status':old['Student Notification Status'] || 'NOT_READY',
      'Student Notified At':old['Student Notified At'] || '',
      'IT Task Email Status':old['IT Task Email Status'] || 'PENDING',
      'IT Task Email Sent At':old['IT Task Email Sent At'] || '',
      'Moodle Task Email Status':old['Moodle Task Email Status'] || 'PENDING',
      'Moodle Task Email Sent At':old['Moodle Task Email Sent At'] || '',
      'E-Library Task Email Status':old['E-Library Task Email Status'] || 'PENDING',
      'E-Library Task Email Sent At':old['E-Library Task Email Sent At'] || '',
      'Last Updated':now,
      'Remarks':old['Remarks'] || ''
    };
    v2Upsert_('V2_PROVISIONING','Reference No',reference,provisioning);
  });

  const taskResult = v2HandoverSendProvisioningTasks_(batch, students);
  const refreshedBatch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (refreshedBatch) {
    v2UpdateRow_(refreshedBatch.sheet,refreshedBatch.rowNumber,{
      'Provisioning Tasks Sent At':taskResult.anySent ? new Date().toISOString() : '',
      'Updated At':new Date().toISOString()
    });
  }

  v2Audit_('', 'ACADEMIC_HANDOVER', 'ACADEMIC_ACCEPTED', {}, {
    batchId:batchId,
    acceptedBy:acceptor,
    studentCount:students.length,
    taskEmailStatus:taskResult
  }, acceptor, 'SUCCESS', 'Academic accepted handover; provisioning tasks were dispatched.');
  v2InvalidateCache_();

  return {
    ok:true,
    batchId:batchId,
    acceptedAt:now,
    acceptedBy:acceptor,
    studentCount:students.length,
    provisioningTasks:taskResult
  };
}

function v2UpdateProvisioningTask_(data, actor) {
  v2HandoverEnsureFoundation_();
  const reference = v2Required_(data.referenceNo,'Reference No');
  const task = String(data.task || '').trim().toUpperCase();
  const status = String(data.status || 'COMPLETED').trim().toUpperCase();
  if (['IT','MOODLE','ELIBRARY'].indexOf(task) < 0) throw new Error('Invalid provisioning task.');
  if (['PENDING','COMPLETED'].indexOf(status) < 0) throw new Error('Invalid provisioning task status.');

  const provisioning = v2Find_('V2_PROVISIONING','Reference No',reference);
  if (!provisioning) throw new Error('Provisioning record not found for this handover student.');

  const payload = {referenceNo:reference,remarks:data.remarks || ''};
  if (task === 'IT') {
    payload.itEmailStatus = status;
    if (data.innovativeEmail !== undefined) payload.innovativeEmail = String(data.innovativeEmail || '').trim();
    if (status === 'COMPLETED' && !String(payload.innovativeEmail || provisioning.record['Innovative Email'] || '').trim()) {
      throw new Error('Enter the Innovative email before marking the IT task complete.');
    }
  } else if (task === 'MOODLE') {
    payload.moodleStatus = status;
  } else {
    payload.eLibraryStatus = status;
  }

  const updated = v2UpdateProvisioning_(payload, actor || 'Admin Portal V2');
  const current = updated.provisioning || {};
  const complete =
    String(current['IT Email Status'] || '').toUpperCase() === 'COMPLETED' &&
    String(current['Moodle Status'] || '').toUpperCase() === 'COMPLETED' &&
    String(current['E-Library Status'] || '').toUpperCase() === 'COMPLETED';

  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (workflow && complete) {
    const readyAt = new Date().toISOString();
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
      'Provisioning Status':'READY_TO_NOTIFY',
      'Academic Handover Status':'HANDED_OVER',
      'Last Updated':readyAt,
      'Updated By':actor || 'Admin Portal V2'
    });
  }

  const handoverStudentRows = v2Rows_('V2_HANDOVER_STUDENTS').filter(function(row){
    return String(row['Reference No'] || '') === reference;
  });
  handoverStudentRows.forEach(function(row){
    const found = v2FindComposite_(
      'V2_HANDOVER_STUDENTS',
      ['Handover Batch ID','Reference No'],
      [row['Handover Batch ID'],reference]
    );
    if (found) {
      v2UpdateRow_(found.sheet,found.rowNumber,{
        'Provisioning Status':complete ? 'READY_TO_NOTIFY' : 'IN_PROGRESS',
        'Handover Status':'ACCEPTED',
        'Last Updated':new Date().toISOString()
      });
    }
  });

  v2Audit_(reference,'PROVISIONING','COMPLETE_TASK',{},{
    task:task,status:status,allProvisioningComplete:complete
  },actor || 'Admin Portal V2','SUCCESS','');
  v2InvalidateCache_();

  return {
    ok:true,
    referenceNo:reference,
    task:task,
    status:status,
    allProvisioningComplete:complete,
    applicationStage:'ACADEMIC_HANDOVER',
    nextAction:complete ? 'SEND_STUDENT_ACCESS' : 'COMPLETE_REMAINING_TASKS',
    provisioning:current
  };
}

function v2SendStudentProvisioningAccess_(data, actor) {
  v2HandoverEnsureFoundation_();
  const reference = v2Required_(data.referenceNo,'Reference No');
  const provisioning = v2Find_('V2_PROVISIONING','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!provisioning || !workflow) throw new Error('Provisioning/workflow record not found.');

  const row = provisioning.record;
  const tasksComplete =
    String(row['IT Email Status'] || '').toUpperCase() === 'COMPLETED' &&
    String(row['Moodle Status'] || '').toUpperCase() === 'COMPLETED' &&
    String(row['E-Library Status'] || '').toUpperCase() === 'COMPLETED';
  if (!tasksComplete) {
    throw new Error('Complete IT, Moodle and e-Library provisioning before sending student access details.');
  }

  const alreadySent = String(row['Student Notification Status'] || '').toUpperCase() === 'SENT';
  const resend = data.resend === true;
  if (alreadySent && !resend) {
    return {
      ok:true,
      alreadySent:true,
      referenceNo:reference,
      studentNotificationStatus:'SENT',
      studentNotifiedAt:row['Student Notified At'] || ''
    };
  }

  const recipient = v2HandoverEmail_(row['Personal Email'] || workflow.record['Personal Email'], 'Student personal email');
  const studentName = String(row['Student Name'] || workflow.record['Student Name'] || 'Student').trim();
  const innovativeEmail = v2HandoverEmail_(row['Innovative Email'], 'Innovative email');
  const moodleLogin = String(data.moodleLogin || row['Moodle Login Email'] || recipient).trim();
  const eLibraryLogin = String(data.eLibraryLogin || innovativeEmail).trim();

  const itPassword = String(data.itTemporaryPassword || '');
  const moodlePassword = String(data.moodleTemporaryPassword || '');
  const eLibraryPassword = String(data.eLibraryTemporaryPassword || '');
  if (!itPassword || !moodlePassword || !eLibraryPassword) {
    throw new Error('Enter the temporary password for Innovative email, Moodle and e-Library before sending.');
  }

  const subject = resend
    ? '[IUC IPGS] Updated Student Access Details'
    : '[IUC IPGS] Your Student Access Details';
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
    '<div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Student Access Details</h2></div>' +
    '<div style="padding:24px"><p>Dear <strong>'+v2Html_(studentName)+'</strong>,</p>' +
    '<p>Your student access setup has been completed. Please use the details below to access the relevant IUC services.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:18px 0">' +
    '<tr><th style="text-align:left;padding:9px;border-bottom:2px solid #ddd">Service</th><th style="text-align:left;padding:9px;border-bottom:2px solid #ddd">Login / Account</th><th style="text-align:left;padding:9px;border-bottom:2px solid #ddd">Temporary Password</th></tr>' +
    '<tr><td style="padding:9px;border-bottom:1px solid #eee">Innovative Email</td><td style="padding:9px;border-bottom:1px solid #eee">'+v2Html_(innovativeEmail)+'</td><td style="padding:9px;border-bottom:1px solid #eee">'+v2Html_(itPassword)+'</td></tr>' +
    '<tr><td style="padding:9px;border-bottom:1px solid #eee">Moodle</td><td style="padding:9px;border-bottom:1px solid #eee">'+v2Html_(moodleLogin)+'</td><td style="padding:9px;border-bottom:1px solid #eee">'+v2Html_(moodlePassword)+'</td></tr>' +
    '<tr><td style="padding:9px;border-bottom:1px solid #eee">e-Library</td><td style="padding:9px;border-bottom:1px solid #eee">'+v2Html_(eLibraryLogin)+'</td><td style="padding:9px;border-bottom:1px solid #eee">'+v2Html_(eLibraryPassword)+'</td></tr>' +
    '</table>' +
    '<p><strong>Security reminder:</strong> Please change any temporary password after your first successful login and do not share your credentials with other users.</p>' +
    '<p>If any access does not work, please contact IPGS Registry so the relevant unit can assist.</p>' +
    '<p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';

  const textBody =
    'Your IUC student access setup has been completed.\n\n' +
    'Innovative Email: ' + innovativeEmail + '\nTemporary Password: ' + itPassword + '\n\n' +
    'Moodle Login: ' + moodleLogin + '\nTemporary Password: ' + moodlePassword + '\n\n' +
    'e-Library Login: ' + eLibraryLogin + '\nTemporary Password: ' + eLibraryPassword + '\n\n' +
    'Please change temporary passwords after your first successful login.';

  const delivery = v2NotificationSend_(
    resend ? 'STUDENT_ACCESS_CREDENTIALS_RESEND' : 'STUDENT_ACCESS_CREDENTIALS',
    [recipient],
    subject,
    textBody,
    html,
    {}
  );

  const now = new Date().toISOString();
  v2UpdateRow_(provisioning.sheet,provisioning.rowNumber,{
    'Student Notification Status':delivery.sent ? 'SENT' : delivery.status,
    'Student Notified At':delivery.sent ? now : (row['Student Notified At'] || ''),
    'Last Updated':now
  });

  if (delivery.sent) {
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
      'Provisioning Status':'COMPLETED',
      'Academic Handover Status':'COMPLETED',
      'Application Stage':'ACTIVE_STUDENT',
      'Innovative Email':innovativeEmail,
      'Last Updated':now,
      'Updated By':actor || 'Admin Portal V2'
    });

    v2Upsert_('V2_ACADEMIC_PORTAL','Reference No',reference,{
      'Reference No':reference,
      'Student ID':'',
      'Student Name':workflow.record['Student Name'] || studentName,
      'Programme':workflow.record['Programme'] || '',
      'Portal Login Email':innovativeEmail,
      'Portal Status':'ACTIVE',
      'Current Academic Stage':'NEWLY_HANDED_OVER',
      'Current Semester':'',
      'Subjects Completed JSON':'[]',
      'Subjects Current JSON':'[]',
      'Subjects Next JSON':'[]',
      'Research Milestone':'',
      'Academic PIC':'',
      'Activated At':now,
      'Last Updated':now
    });

    const handoverRows = v2Rows_('V2_HANDOVER_STUDENTS').filter(function(item){
      return String(item['Reference No'] || '') === reference;
    });
    handoverRows.forEach(function(item){
      const found = v2FindComposite_(
        'V2_HANDOVER_STUDENTS',
        ['Handover Batch ID','Reference No'],
        [item['Handover Batch ID'],reference]
      );
      if (found) {
        v2UpdateRow_(found.sheet,found.rowNumber,{
          'Provisioning Status':'COMPLETED',
          'Handover Status':'COMPLETED',
          'Last Updated':now
        });
      }
    });
  }

  v2Audit_(reference,'PROVISIONING',resend ? 'RESEND_STUDENT_ACCESS' : 'SEND_STUDENT_ACCESS',{},{
    notificationStatus:delivery.status,
    innovativeEmail:innovativeEmail,
    moodleLogin:moodleLogin,
    eLibraryLogin:eLibraryLogin,
    credentialsStored:false
  },actor || 'Admin Portal V2',delivery.sent ? 'SUCCESS' : 'SKIPPED','Passwords were used only for delivery and were not stored in the spreadsheet or audit log.');

  v2InvalidateCache_();
  return {
    ok:true,
    referenceNo:reference,
    sent:delivery.sent,
    status:delivery.status,
    applicationStage:delivery.sent ? 'ACTIVE_STUDENT' : 'ACADEMIC_HANDOVER',
    provisioningStatus:delivery.sent ? 'COMPLETED' : 'READY_TO_NOTIFY',
    credentialsStored:false
  };
}

function v2ResendProvisioningTaskEmails_(data, actor) {
  v2HandoverEnsureFoundation_();
  const batchId = v2Required_(data.batchId,'Handover Batch ID');
  const batch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (!batch) throw new Error('Academic Handover batch not found.');
  const students = v2HandoverStudents_(batchId);
  const result = v2HandoverSendProvisioningTasks_(batch.record,students);
  v2Audit_('', 'ACADEMIC_HANDOVER', 'RESEND_PROVISIONING_TASKS', {}, {
    batchId:batchId,result:result
  }, actor || 'Admin Portal V2', 'SUCCESS', '');
  v2InvalidateCache_();
  return {ok:true,batchId:batchId,result:result};
}

function v2HandoverSendAcademicEmail_(batch, students, pdfFileId, resend) {
  const recipient = String(batch['Academic Email'] || '').trim();
  const batchId = String(batch['Handover Batch ID'] || '');
  const name = String(batch['Handover Name'] || batchId);
  const subject = '[IUC IPGS] Academic Handover - ' + name;
  const rows = students.map(function(student){
    return '<tr><td style="padding:8px;border-bottom:1px solid #eee">'+v2Html_(student.studentName || student['Student Name'])+'</td>' +
      '<td style="padding:8px;border-bottom:1px solid #eee">'+v2Html_(student.programme || student['Programme'])+'</td></tr>';
  }).join('');
  const html = '<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
    '<div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Academic Handover</h2></div>' +
    '<div style="padding:24px"><p>Dear Academic Team,</p>' +
    '<p>Registry has handed over the following students for Academic processing.</p>' +
    '<p><strong>Batch:</strong> '+v2Html_(name)+'<br><strong>Batch ID:</strong> '+v2Html_(batchId)+'<br><strong>Students:</strong> '+students.length+'</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Student</th><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Programme</th></tr></thead><tbody>'+rows+'</tbody></table>' +
    '<p>The handover document is attached for reference. IT, Moodle and e-Library PICs are notified from the same handover batch.</p>' +
    '<p>Regards,<br><strong>IPGS Registry</strong></p></div></div>';
  const attachment = DriveApp.getFileById(pdfFileId).getBlob();
  return v2NotificationSend_(
    resend ? 'ACADEMIC_HANDOVER_RESEND' : 'ACADEMIC_HANDOVER',
    [recipient],
    subject,
    'Academic Handover: '+name+'\nBatch ID: '+batchId+'\nStudents: '+students.length,
    html,
    {attachments:[attachment]}
  );
}

function v2HandoverSendProvisioningTasks_(batch, students) {
  const now = new Date().toISOString();
  const batchId = String(batch['Handover Batch ID'] || '');
  const tasks = [
    {
      key:'IT',
      event:'PROVISIONING_IT_TASK',
      recipient:String(batch['IT PIC Email'] || ''),
      subject:'[IUC IPGS] Task - Create Innovative Email - '+batchId,
      title:'Create Innovative Email',
      instruction:'Please create the Innovative email account for each student in this handover batch.'
    },
    {
      key:'MOODLE',
      event:'PROVISIONING_MOODLE_TASK',
      recipient:String(batch['Moodle PIC Email'] || ''),
      subject:'[IUC IPGS] Task - Create Moodle Access - '+batchId,
      title:'Create Moodle Access',
      instruction:'Please create Moodle access for each student. Moodle login may use the student personal email unless Academic specifies otherwise.'
    },
    {
      key:'ELIBRARY',
      event:'PROVISIONING_ELIBRARY_TASK',
      recipient:String(batch['E-Library PIC Email'] || ''),
      subject:'[IUC IPGS] Task - Create e-Library Access - '+batchId,
      title:'Create e-Library Access',
      instruction:'Please create e-Library access for each student. If an Innovative email is required, coordinate with IT once the account is available.'
    }
  ];

  const tableRows = students.map(function(student){
    return '<tr><td style="padding:7px;border-bottom:1px solid #eee">'+v2Html_(student['Student Name'])+'</td>' +
      '<td style="padding:7px;border-bottom:1px solid #eee">'+v2Html_(student['ID / Passport No'])+'</td>' +
      '<td style="padding:7px;border-bottom:1px solid #eee">'+v2Html_(student['Personal Email'])+'</td>' +
      '<td style="padding:7px;border-bottom:1px solid #eee">'+v2Html_(student['Programme'])+'</td></tr>';
  }).join('');

  const result = {};
  let anySent = false;
  tasks.forEach(function(task){
    const html = '<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
      '<div style="background:#2d2363;color:#fff;padding:22px"><h2 style="margin:0">'+v2Html_(task.title)+'</h2></div>' +
      '<div style="padding:24px"><p>'+v2Html_(task.instruction)+'</p><p><strong>Handover Batch:</strong> '+v2Html_(batchId)+'<br><strong>Students:</strong> '+students.length+'</p>' +
      '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:7px">Student</th><th style="text-align:left;padding:7px">ID</th><th style="text-align:left;padding:7px">Personal Email</th><th style="text-align:left;padding:7px">Programme</th></tr></thead><tbody>'+tableRows+'</tbody></table>' +
      '<p>Please update Registry once the assigned access has been created.</p><p>Regards,<br><strong>IPGS Registry</strong></p></div></div>';
    const delivery = v2NotificationSend_(
      task.event,
      [task.recipient],
      task.subject,
      task.title+' for handover batch '+batchId,
      html,
      {}
    );
    result[task.key] = delivery.status;
    if (delivery.sent) anySent = true;

    students.forEach(function(student){
      const provisioning = v2Find_('V2_PROVISIONING','Reference No',student['Reference No']);
      if (!provisioning) return;
      const patch = {'Last Updated':new Date().toISOString()};
      if (task.key === 'IT') {
        patch['IT Task Email Status'] = delivery.status;
        patch['IT Task Email Sent At'] = delivery.sent ? now : '';
      } else if (task.key === 'MOODLE') {
        patch['Moodle Task Email Status'] = delivery.status;
        patch['Moodle Task Email Sent At'] = delivery.sent ? now : '';
      } else {
        patch['E-Library Task Email Status'] = delivery.status;
        patch['E-Library Task Email Sent At'] = delivery.sent ? now : '';
      }
      v2UpdateRow_(provisioning.sheet,provisioning.rowNumber,patch);
    });
  });

  result.anySent = anySent;
  return result;
}

function v2HandoverGeneratePdf_(batchId, name, students, actor) {
  const root = DriveApp.getFolderById(CONFIG.rootFolderId);
  const handoverRoot = v2HandoverGetOrCreateFolder_(root,'V2_HANDOVER_BATCHES');
  const folder = v2HandoverGetOrCreateFolder_(handoverRoot,batchId);
  const fileName = 'ADMISSION_TO_ACADEMIC_HANDOVER_' + batchId + '.pdf';

  const rows = students.map(function(student,index){
    return '<tr><td>'+(index+1)+'</td><td>'+v2Html_(student.studentName)+'</td><td>'+v2Html_(student.idPassport)+'</td><td>'+v2Html_(student.programme)+'</td><td>'+v2Html_(student.intake)+'</td></tr>';
  }).join('');
  const html = '<html><head><style>' +
    '@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#172033;font-size:10.5pt}h1{font-size:18pt;color:#2d2363;margin:0 0 4px}h2{font-size:11pt;margin:0 0 18px;color:#555}.meta{margin:14px 0 18px;padding:10px 12px;background:#f6f4fb;border:1px solid #e2dcf2}.meta div{margin:3px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9dde5;padding:6px;vertical-align:top}th{background:#2d2363;color:white;text-align:left;font-size:9pt}.foot{margin-top:22px;font-size:9pt;color:#667085}.sign{margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.line{border-top:1px solid #333;margin-top:38px;padding-top:6px}' +
    '</style></head><body>' +
    '<h1>Innovative University College</h1><h2>Institute of Postgraduate Studies (IPGS)</h2>' +
    '<div style="font-size:15pt;font-weight:bold;margin-bottom:8px">Admission to Academic Handover</div>' +
    '<div class="meta"><div><strong>Batch:</strong> '+v2Html_(name)+'</div><div><strong>Batch ID:</strong> '+v2Html_(batchId)+'</div><div><strong>Date:</strong> '+v2Html_(Utilities.formatDate(new Date(),CONFIG.timezone||'Asia/Kuala_Lumpur','dd MMMM yyyy'))+'</div><div><strong>Total Students:</strong> '+students.length+'</div></div>' +
    '<table><thead><tr><th>No.</th><th>Student</th><th>ID / Passport</th><th>Programme</th><th>Intake</th></tr></thead><tbody>'+rows+'</tbody></table>' +
    '<div class="foot">This system-generated document records the Registry handover of the listed students to Academic and the relevant service units.</div>' +
    '<div class="sign"><div><div class="line">Prepared by Registry</div></div><div><div class="line">Received by Academic</div></div></div>' +
    '</body></html>';

  const blob = Utilities.newBlob(html,'text/html','handover.html').getAs(MimeType.PDF).setName(fileName);
  const file = folder.createFile(blob);
  return {fileId:file.getId(),url:file.getUrl(),fileName:file.getName(),folderUrl:folder.getUrl(),preparedBy:actor};
}

function v2HandoverStudents_(batchId) {
  return v2Rows_('V2_HANDOVER_STUDENTS').filter(function(row){
    return String(row['Handover Batch ID'] || '') === String(batchId || '');
  });
}

function v2HandoverResolveToken_(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const hash = v2HandoverHash_(raw);
  const rows = v2Rows_('V2_HANDOVER_BATCHES');
  const match = rows.filter(function(row){
    return String(row['Academic Accept Token Hash'] || '') === hash;
  })[0];
  if (!match) return null;
  return v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',match['Handover Batch ID']);
}

function v2HandoverToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g,'');
}

function v2HandoverHash_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b){
    const n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function v2HandoverWebAppUrl_() {
  const serviceUrl = String(ScriptApp.getService().getUrl() || '').trim();
  if (serviceUrl) return serviceUrl;
  return 'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';
}

function v2HandoverGetOrCreateFolder_(parent, name) {
  const existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

function v2HandoverExtractDriveId_(value) {
  const text = String(value || '').trim();
  const match = text.match(/[-A-Za-z0-9_]{20,}/);
  return match ? match[0] : '';
}

function v2HandoverEmail_(value, label) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(label + ' is required and must be valid.');
  return email;
}
