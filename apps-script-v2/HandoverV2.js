/**
 * Admission V2 - Stage 5 Academic Handover & Provisioning
 *
 * Flow:
 * Orientation ATTENDED -> create handover batch -> email Academic ->
 * Academic accepts secure handover -> notify IT/Moodle/Library ->
 * Registry tracks provisioning completion -> ACTIVE_STUDENT.
 */

const V2_HANDOVER_BUILD = 'ACADEMIC_HANDOVER_V2_STAGE5_20260918';

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
  const name = String(data.name || '').trim() || ('Admission to Academic Handover - ' + Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'dd MMM yyyy'));
  const now = new Date().toISOString();

  const students = references.map(function(reference) {
    const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
    const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
    if (!workflow || !application) throw new Error('Application/workflow not found for ' + reference + '.');

    const orientation = String(workflow.record['Orientation Status'] || '').toUpperCase();
    const handover = String(workflow.record['Academic Handover Status'] || '').toUpperCase();
    const stage = String(workflow.record['Application Stage'] || '').toUpperCase();
    if (orientation !== 'ATTENDED') {
      throw new Error((workflow.record['Student Name'] || reference) + ' has not completed Orientation.');
    }
    if (handover !== 'READY' || stage !== 'ORIENTATION') {
      throw new Error((workflow.record['Student Name'] || reference) + ' is not READY for Academic Handover.');
    }

    return {
      referenceNo:reference,
      studentName:String(workflow.record['Student Name'] || application.record['Student Name'] || ''),
      idPassport:String(workflow.record['ID / Passport No'] || application.record['ID / Passport No'] || ''),
      personalEmail:String(application.record['Personal Email'] || workflow.record['Personal Email'] || ''),
      programme:String(workflow.record['Programme'] || application.record['Programme'] || ''),
      intake:String(application.record['Intake'] || workflow.record['Intake'] || ''),
      orientationSessionId:String(workflow.record['Orientation Session ID'] || ''),
      orientationStatus:orientation
    };
  });

  const batchId = 'HND-' + Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0,6).toUpperCase();
  const token = v2HandoverToken_();
  const tokenHash = v2HandoverHash_(token);
  const acceptUrl = v2HandoverWebAppUrl_() + '?page=academic-handover-v2&token=' + encodeURIComponent(token);
  const pdf = v2HandoverGeneratePdf_(batchId, name, students, actor || 'Admin Portal V2');

  const intakeValues = Array.from(new Set(students.map(function(s){return s.intake;}).filter(Boolean)));
  const row = {
    'Handover Batch ID':batchId,
    'Handover Name':name,
    'Status':'PENDING_ACADEMIC_ACCEPTANCE',
    'Student Count':students.length,
    'Intake Summary':intakeValues.join(', '),
    'Academic Email':academicEmail,
    'IT PIC Email':itEmail,
    'Moodle PIC Email':moodleEmail,
    'E-Library PIC Email':libraryEmail,
    'Handover PDF URL':pdf.url,
    'Academic Accept Token Hash':tokenHash,
    'Academic Accept URL':acceptUrl,
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
      'Handover Status':'PENDING_ACADEMIC_ACCEPTANCE',
      'Accepted At':'',
      'Provisioning Status':'NOT_STARTED',
      'Last Updated':now
    });

    const workflow = v2Find_('V2_WORKFLOW','Reference No',student.referenceNo);
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
      'Application Stage':'ACADEMIC_HANDOVER',
      'Academic Handover Status':'PENDING_ACADEMIC_ACCEPTANCE',
      'Provisioning Status':'NOT_STARTED',
      'Last Updated':now,
      'Updated By':actor || 'Admin Portal V2'
    });
    const orientation = v2FindComposite_(
      'V2_ORIENTATION_TRACKING',
      ['Orientation Session ID','Reference No'],
      [student.orientationSessionId,student.referenceNo]
    );
    if (orientation) {
      v2UpdateRow_(orientation.sheet,orientation.rowNumber,{
        'Academic Handover Status':'PENDING_ACADEMIC_ACCEPTANCE',
        'Last Updated':now
      });
    }
  });

  const emailResult = v2HandoverSendAcademicEmail_(row, students, pdf.fileId, false);
  const batch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (batch) {
    v2UpdateRow_(batch.sheet,batch.rowNumber,{
      'Academic Email Status':emailResult.status,
      'Academic Email Sent At':emailResult.sent ? new Date().toISOString() : '',
      'Updated At':new Date().toISOString()
    });
  }

  v2Audit_('', 'ACADEMIC_HANDOVER', 'CREATE_HANDOVER_BATCH', {}, {
    batchId:batchId,
    studentCount:students.length,
    academicEmailStatus:emailResult.status,
    pdfUrl:pdf.url
  }, actor || 'Admin Portal V2', 'SUCCESS', 'Students transferred to pending Academic acceptance.');
  v2InvalidateCache_();

  return {
    ok:true,
    batchId:batchId,
    studentCount:students.length,
    pdfUrl:pdf.url,
    acceptUrl:acceptUrl,
    academicEmailStatus:emailResult.status,
    build:V2_HANDOVER_BUILD
  };
}

function v2ResendAcademicHandoverEmail_(data, actor) {
  v2HandoverEnsureFoundation_();
  const batchId = v2Required_(data.batchId,'Handover Batch ID');
  const batch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (!batch) throw new Error('Academic Handover batch not found.');
  if (String(batch.record['Status'] || '').toUpperCase() === 'ACCEPTED') {
    throw new Error('Academic Handover has already been accepted.');
  }
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
        'Handover Status':'ACCEPTED',
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
  if (!provisioning) throw new Error('Provisioning record not found. Academic must accept the handover first.');

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
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
      'Provisioning Status':'COMPLETED',
      'Academic Handover Status':'COMPLETED',
      'Application Stage':'ACTIVE_STUDENT',
      'Last Updated':new Date().toISOString(),
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
        'Provisioning Status':complete ? 'COMPLETED' : 'IN_PROGRESS',
        'Handover Status':complete ? 'COMPLETED' : 'ACCEPTED',
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
    applicationStage:complete ? 'ACTIVE_STUDENT' : 'ACADEMIC_HANDOVER',
    provisioning:current
  };
}

function v2ResendProvisioningTaskEmails_(data, actor) {
  v2HandoverEnsureFoundation_();
  const batchId = v2Required_(data.batchId,'Handover Batch ID');
  const batch = v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
  if (!batch) throw new Error('Academic Handover batch not found.');
  if (String(batch.record['Status'] || '').toUpperCase() !== 'ACCEPTED') {
    throw new Error('Provisioning tasks can only be sent after Academic accepts the handover.');
  }
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
  const acceptUrl = String(batch['Academic Accept URL'] || '');
  const subject = '[IUC IPGS] Admission to Academic Handover - ' + name;
  const rows = students.map(function(student){
    return '<tr><td style="padding:8px;border-bottom:1px solid #eee">'+v2Html_(student.studentName || student['Student Name'])+'</td>' +
      '<td style="padding:8px;border-bottom:1px solid #eee">'+v2Html_(student.programme || student['Programme'])+'</td></tr>';
  }).join('');
  const html = '<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
    '<div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Admission to Academic Handover</h2></div>' +
    '<div style="padding:24px"><p>Dear Academic Team,</p>' +
    '<p>Registry is transferring the following admitted postgraduate students to Academic.</p>' +
    '<p><strong>Batch:</strong> '+v2Html_(name)+'<br><strong>Batch ID:</strong> '+v2Html_(batchId)+'<br><strong>Students:</strong> '+students.length+'</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Student</th><th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Programme</th></tr></thead><tbody>'+rows+'</tbody></table>' +
    '<p>The formal handover document is attached. Please review the batch and confirm receipt.</p>' +
    '<div style="text-align:center;margin:24px 0"><a href="'+v2Html_(acceptUrl)+'" style="display:inline-block;background:#2d2363;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:bold">Accept Handover</a></div>' +
    '<p style="font-size:12px;color:#697386">After acceptance, the system will notify the relevant IT, Moodle and e-Library PICs to create student access.</p>' +
    '<p>Regards,<br><strong>IPGS Registry</strong></p></div></div>';
  const attachment = DriveApp.getFileById(pdfFileId).getBlob();
  return v2NotificationSend_(
    resend ? 'ACADEMIC_HANDOVER_RESEND' : 'ACADEMIC_HANDOVER',
    [recipient],
    subject,
    'Registry Academic Handover: '+name+'\nAccept handover: '+acceptUrl,
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
    return '<tr><td>'+(index+1)+'</td><td>'+v2Html_(student.studentName)+'</td><td>'+v2Html_(student.idPassport)+'</td><td>'+v2Html_(student.programme)+'</td><td>'+v2Html_(student.intake)+'</td><td>ATTENDED</td></tr>';
  }).join('');
  const html = '<html><head><style>' +
    '@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#172033;font-size:10.5pt}h1{font-size:18pt;color:#2d2363;margin:0 0 4px}h2{font-size:11pt;margin:0 0 18px;color:#555}.meta{margin:14px 0 18px;padding:10px 12px;background:#f6f4fb;border:1px solid #e2dcf2}.meta div{margin:3px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d9dde5;padding:6px;vertical-align:top}th{background:#2d2363;color:white;text-align:left;font-size:9pt}.foot{margin-top:22px;font-size:9pt;color:#667085}.sign{margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.line{border-top:1px solid #333;margin-top:38px;padding-top:6px}' +
    '</style></head><body>' +
    '<h1>Innovative University College</h1><h2>Institute of Postgraduate Studies (IPGS)</h2>' +
    '<div style="font-size:15pt;font-weight:bold;margin-bottom:8px">Admission to Academic Handover</div>' +
    '<div class="meta"><div><strong>Batch:</strong> '+v2Html_(name)+'</div><div><strong>Batch ID:</strong> '+v2Html_(batchId)+'</div><div><strong>Date:</strong> '+v2Html_(Utilities.formatDate(new Date(),CONFIG.timezone||'Asia/Kuala_Lumpur','dd MMMM yyyy'))+'</div><div><strong>Total Students:</strong> '+students.length+'</div></div>' +
    '<table><thead><tr><th>No.</th><th>Student</th><th>ID / Passport</th><th>Programme</th><th>Intake</th><th>Orientation</th></tr></thead><tbody>'+rows+'</tbody></table>' +
    '<div class="foot">This system-generated document records the formal transfer of admitted students from Registry to Academic after completion of the required admission and orientation process.</div>' +
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
