/*
 * Admission V2 - Acceptance Pack
 *
 * One student e-signature is applied to the approved signable admission
 * documents. Signed PDFs are saved inside the applicant's existing V2
 * student folder. V1 is never read or modified by this module.
 */

const V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS = {
  acceptanceEn: '1JuIwpkPXIebWohnJrBUyJLw5flbVi3nbX0IsOgYlzlg',
  suratPenerimaan: '1-fG3WrLOIpl3yl0Mqt4Geqiw1g6FNwGJ2DvXbtXmUB4',
  suratAkuan: '1dwVfTaHh5Zue_Ob2521ZoGHK-nwIC-WV7yK8p8m7pPc',
  studentHandbook: '15k9C77Zo85f6E-DzBDbQVEr1n_zXT6rz',
  handbookAcknowledgement: '1gOCTcpm6TdDMExgSTuTtACGSciXxYo7CeGvV7amfJ_k'
};

const V2_ACCEPTANCE_PACK_HEADERS = [
  'Acceptance Review PDF URL',
  'Surat Penerimaan Review PDF URL',
  'Surat Akuan Review PDF URL',
  'Student Handbook Acknowledgement Review PDF URL',
  'Student Handbook URL',
  'Surat Penerimaan Signed PDF URL',
  'Surat Akuan Signed PDF URL',
  'Student Handbook Acknowledgement Signed PDF URL',
  'Acceptance Pack Status',
  'Acceptance Pack Signed At'
];

function v2AcceptancePackTemplateIds_() {
  return {
    acceptanceEn: String(
      CONFIG.acceptanceEnTemplateId ||
      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.acceptanceEn
    ).trim(),
    suratPenerimaan: String(
      CONFIG.suratPenerimaanTemplateId ||
      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.suratPenerimaan
    ).trim(),
    suratAkuan: String(
      CONFIG.suratAkuanTemplateId ||
      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.suratAkuan
    ).trim(),
    studentHandbook: String(
      CONFIG.studentHandbookFileId ||
      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.studentHandbook
    ).trim(),
    handbookAcknowledgement: String(
      CONFIG.studentHandbookAcknowledgementTemplateId ||
      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.handbookAcknowledgement
    ).trim()
  };
}

function v2AcceptancePackEnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const workflow = ss.getSheetByName('V2_WORKFLOW');
  if (!workflow) throw new Error('V2_WORKFLOW sheet not found.');

  v2OfferEnsureHeaders_(workflow, V2_ACCEPTANCE_PACK_HEADERS);
  return workflow;
}

function v2AcceptancePackContext_(referenceNo) {
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!application || !workflow) {
    throw new Error('Acceptance application/workflow record not found.');
  }

  const folderUrl = String(
    application.record['Student Folder URL'] ||
    workflow.record['Student Folder URL'] ||
    ''
  ).trim();
  const folderId = v2OfferExtractDriveId_(folderUrl);
  if (!folderId) throw new Error('Student folder could not be identified.');

  const app = application.record;
  return {
    referenceNo: reference,
    application: application,
    workflow: workflow,
    studentFolder: DriveApp.getFolderById(folderId),
    studentName: String(app['Student Name'] || '').trim(),
    idPassport: String(app['ID / Passport No'] || '').trim(),
    programme: String(app['Programme'] || '').trim(),
    intake: v2OfferDisplayIntake_(app['Intake'] || ''),
    studyMode: String(app['Study Mode'] || app['Mode of Study'] || '').trim()
  };
}

function v2AcceptancePackSafeName_(value) {
  const clean = String(value || '')
    .replace(/[\\/:*?"<>|#%{}]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return clean || 'STUDENT';
}

function v2AcceptancePackMonthYear_(intake) {
  const value = String(intake || '').trim();
  const month = (value.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i) || [,''])[1];
  const year = (value.match(/\b(20\d{2})\b/) || [,''])[1];
  return {month: month, year: year};
}

function v2AcceptancePackDate_(date) {
  return Utilities.formatDate(
    date,
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'd MMMM yyyy'
  );
}

function v2AcceptancePackModeMalay_(mode) {
  const value = String(mode || '').toUpperCase();
  if (value.indexOf('PART') > -1) return 'separuh masa';
  if (value.indexOf('ONLINE') > -1 || value.indexOf('ODL') > -1) return 'dalam talian';
  return 'sepenuh masa';
}

function v2AcceptancePackFillDoc_(body, ctx) {
  const my = v2AcceptancePackMonthYear_(ctx.intake);
  const replacements = {
    '{{STUDENT_NAME}}': ctx.studentName,
    '{{IC}}': ctx.idPassport,
    '{{PROGRAMME_NAME}}': ctx.programme,
    '{{STUDY_MODE}}': ctx.studyMode,
    '{{INTAKE}}': ctx.intake,
    '{{SESSION_MONTH}}': my.month,
    '{{SESSION_YEAR}}': my.year,
    '{{SIGNED_DATE}}': ''
  };

  Object.keys(replacements).forEach(function(key) {
    body.replaceText(
      v2OfferRegexEscape_(key),
      String(replacements[key] || '')
    );
  });

  if (ctx.studyMode) {
    body.replaceText(
      'full-time/part-time',
      String(ctx.studyMode).toLowerCase()
    );
    body.replaceText(
      'secara\\s+sepenuh\\s+masa',
      'secara ' + v2AcceptancePackModeMalay_(ctx.studyMode)
    );
  }
}

function v2AcceptancePackFindParagraph_(body, needles) {
  const list = Array.isArray(needles) ? needles : [needles];
  const paragraphs = body.getParagraphs();
  for (let i = 0; i < paragraphs.length; i += 1) {
    const text = String(paragraphs[i].getText() || '').trim();
    for (let n = 0; n < list.length; n += 1) {
      if (text.indexOf(list[n]) > -1) return paragraphs[i];
    }
  }
  return null;
}

function v2AcceptancePackAppendSignature_(paragraph, label, signatureBlob) {
  paragraph.clear();
  if (label) paragraph.appendText(label + ' ');
  const image = paragraph.appendInlineImage(signatureBlob.copyBlob());
  image.setWidth(180);
  image.setHeight(60);
  return paragraph;
}

function v2AcceptancePackApplySignature_(body, docType, signatureBlob, signedName, signedDate) {
  if (docType === 'ACCEPTANCE_EN') {
    const signaturePara = v2AcceptancePackFindParagraph_(body, [
      'Student’s Signature',
      "Student's Signature"
    ]);
    if (!signaturePara) throw new Error('Acceptance signature field was not found in the approved template.');
    v2AcceptancePackAppendSignature_(signaturePara, 'Student’s Signature :', signatureBlob);

    const datePara = v2AcceptancePackFindParagraph_(body, ['Date']);
    if (datePara) {
      datePara.clear();
      datePara.appendText('Date : ' + signedDate);
    }
    return;
  }

  if (docType === 'SURAT_PENERIMAAN') {
    const signaturePara = v2AcceptancePackFindParagraph_(body, ['Tandatangan Pelajar']);
    if (!signaturePara) throw new Error('Surat Penerimaan signature field was not found in the approved template.');
    v2AcceptancePackAppendSignature_(signaturePara, 'Tandatangan Pelajar :', signatureBlob);

    const datePara = v2AcceptancePackFindParagraph_(body, ['Tarikh']);
    if (datePara) {
      datePara.clear();
      datePara.appendText('Tarikh : ' + signedDate);
    }
    return;
  }

  if (docType === 'SURAT_AKUAN') {
    const bodyChildren = body.getNumChildren();
    let target = null;
    const paragraphs = body.getParagraphs();
    for (let i = 0; i < paragraphs.length; i += 1) {
      const text = String(paragraphs[i].getText() || '').trim();
      if (/^[…\.]{5,}$/.test(text) || text.indexOf('……………………') > -1) {
        target = paragraphs[i];
        break;
      }
    }
    if (!target) {
      const truePara = v2AcceptancePackFindParagraph_(body, ['Yang Benar']);
      if (truePara) target = body.appendParagraph('');
    }
    if (!target) throw new Error('Surat Akuan signature field was not found in the approved template.');

    v2AcceptancePackAppendSignature_(target, '', signatureBlob);
    target.appendText('\nTarikh: ' + signedDate);
    return;
  }

  if (docType === 'HANDBOOK_ACKNOWLEDGEMENT') {
    const signaturePara = v2AcceptancePackFindParagraph_(body, [
      'Student’s Signature',
      "Student's Signature"
    ]);
    if (!signaturePara) {
      throw new Error('Student Handbook acknowledgement signature field was not found in the approved template.');
    }
    v2AcceptancePackAppendSignature_(signaturePara, 'Student’s Signature :', signatureBlob);

    const datePara = v2AcceptancePackFindParagraph_(body, ['Date:']);
    if (datePara) {
      datePara.clear();
      datePara.appendText('Date : ' + signedDate);
    }
    return;
  }

  throw new Error('Unsupported acceptance document type: ' + docType);
}

function v2AcceptancePackCreatePdf_(ctx, spec, options) {
  const opts = options || {};
  const source = DriveApp.getFileById(spec.templateId);
  const temp = source.makeCopy(
    'V2_TEMP_' + spec.code + '_' + Utilities.getUuid(),
    ctx.studentFolder
  );

  try {
    const doc = DocumentApp.openById(temp.getId());
    const body = doc.getBody();
    v2AcceptancePackFillDoc_(body, ctx);

    if (opts.signatureBlob) {
      v2AcceptancePackApplySignature_(
        body,
        spec.code,
        opts.signatureBlob,
        ctx.studentName,
        opts.signedDate
      );
    }

    doc.saveAndClose();

    const pdf = DriveApp.getFileById(temp.getId())
      .getAs(MimeType.PDF)
      .setName(opts.fileName);
    return ctx.studentFolder.createFile(pdf);
  } finally {
    try { temp.setTrashed(true); } catch (ignore) {}
  }
}

function v2AcceptancePackUrlExists_(url) {
  const id = v2OfferExtractDriveId_(url);
  if (!id) return false;
  try {
    const file = DriveApp.getFileById(id);
    return !file.isTrashed();
  } catch (error) {
    return false;
  }
}

function v2AcceptancePackTrashUrl_(url) {
  const id = v2OfferExtractDriveId_(url);
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (ignore) {}
}

function v2AcceptancePackSpecs_() {
  const ids = v2AcceptancePackTemplateIds_();
  return [
    {
      code: 'ACCEPTANCE_EN',
      label: 'Acceptance & Student Handbook Confirmation',
      templateId: ids.acceptanceEn,
      reviewField: 'Acceptance Review PDF URL',
      signedField: 'Acceptance PDF URL',
      reviewPrefix: 'REVIEW_Acceptance_Handbook_',
      signedPrefix: 'SIGNED_Acceptance_Handbook_'
    },
    {
      code: 'SURAT_PENERIMAAN',
      label: 'Surat Penerimaan Tawaran',
      templateId: ids.suratPenerimaan,
      reviewField: 'Surat Penerimaan Review PDF URL',
      signedField: 'Surat Penerimaan Signed PDF URL',
      reviewPrefix: 'REVIEW_Surat_Penerimaan_',
      signedPrefix: 'SIGNED_Surat_Penerimaan_'
    },
    {
      code: 'SURAT_AKUAN',
      label: 'Surat Akuan',
      templateId: ids.suratAkuan,
      reviewField: 'Surat Akuan Review PDF URL',
      signedField: 'Surat Akuan Signed PDF URL',
      reviewPrefix: 'REVIEW_Surat_Akuan_',
      signedPrefix: 'SIGNED_Surat_Akuan_'
    }
  ];
}

function v2AcceptancePackEnsureReviewDocs_(referenceNo, actor) {
  assertDevIdentity_();
  v2AcceptancePackEnsureHeaders_();

  const ctx = v2AcceptancePackContext_(referenceNo);
  const offerStatus = String(ctx.workflow.record['Offer Letter Status'] || '');
  if (offerStatus !== 'ISSUED') {
    throw new Error('Acceptance documents are available only after the Offer Letter is issued.');
  }

  const safeName = v2AcceptancePackSafeName_(ctx.studentName);
  const updates = {};
  const documents = [];

  v2AcceptancePackSpecs_().forEach(function(spec) {
    let url = String(ctx.workflow.record[spec.reviewField] || '').trim();
    if (!v2AcceptancePackUrlExists_(url)) {
      const file = v2AcceptancePackCreatePdf_(ctx, spec, {
        fileName: spec.reviewPrefix + safeName + '.pdf'
      });
      url = file.getUrl();
      updates[spec.reviewField] = url;
    }
    documents.push({
      code: spec.code,
      label: spec.label,
      url: url,
      signRequired: true
    });
  });

  // Review the exact acknowledgement page from the approved Student Handbook.
  documents.push({
    code: 'HANDBOOK_ACKNOWLEDGEMENT',
    label: 'Student Handbook Acknowledgement',
    url: v2AcceptanceHandbookAckPublicUrl_(),
    signRequired: true
  });

  const ids = v2AcceptancePackTemplateIds_();
  const handbookUrl = v2AcceptanceHandbookPublicUrl_();
  if (String(ctx.workflow.record['Student Handbook URL'] || '').trim() !== handbookUrl) {
    updates['Student Handbook URL'] = handbookUrl;
  }

  updates['Acceptance Pack Status'] = 'READY_FOR_SIGNATURE';
  updates['Last Updated'] = new Date().toISOString();
  updates['Updated By'] = actor || 'Acceptance Pack Preparation';

  if (Object.keys(updates).length) {
    v2UpdateRow_(ctx.workflow.sheet, ctx.workflow.rowNumber, updates);
    v2InvalidateCache_();
  }

  return {
    ok: true,
    referenceNo: ctx.referenceNo,
    documents: documents,
    handbookUrl: handbookUrl,
    status: 'READY_FOR_SIGNATURE'
  };
}

function v2GetAcceptancePackForToken(rawToken) {
  assertDevIdentity_();
  const tokenResult = v2ValidateAcceptanceToken_(rawToken);
  const ctx = v2AcceptancePackContext_(tokenResult.referenceNo);
  const acceptanceStatus = String(ctx.workflow.record['Acceptance Status'] || 'PENDING').toUpperCase();

  let pack = {documents: [], handbookUrl: ''};
  if (acceptanceStatus !== 'ACCEPTED') {
    pack = v2AcceptancePackEnsureReviewDocs_(
      ctx.referenceNo,
      'Student Acceptance Page'
    );
  }

  const offerUrl = String(ctx.workflow.record['Offer Letter PDF URL'] || '').trim();
  const docs = [];
  if (offerUrl) docs.push({
    code: 'OFFER_LETTER',
    label: 'Offer Letter',
    url: offerUrl,
    signRequired: false
  });
  (pack.documents || []).forEach(function(doc) { docs.push(doc); });
  if (pack.handbookUrl) {
    docs.push({
      code: 'STUDENT_HANDBOOK',
      label: 'Postgraduate Student Handbook',
      url: pack.handbookUrl,
      signRequired: false,
      downloadOnly: true
    });
  }

  return {
    ok: true,
    referenceNo: ctx.referenceNo,
    studentName: ctx.studentName,
    idPassport: ctx.idPassport,
    programme: ctx.programme,
    intake: ctx.intake,
    studyMode: v2OfferDisplayStudyMode_(ctx.studyMode),
    handbookAcknowledgementBackgroundDataUrl: v2AcceptanceHandbookAckBackgroundDataUrl_(),
    acceptanceStatus: acceptanceStatus,
    documents: docs,
    signedDocuments: {
      acceptance: String(ctx.workflow.record['Acceptance PDF URL'] || ''),
      suratPenerimaan: String(ctx.workflow.record['Surat Penerimaan Signed PDF URL'] || ''),
      suratAkuan: String(ctx.workflow.record['Surat Akuan Signed PDF URL'] || ''),
      handbookAcknowledgement: String(ctx.workflow.record['Student Handbook Acknowledgement Signed PDF URL'] || '')
    }
  };
}

function v2AcceptancePackSignatureBlob_(signatureDataUrl) {
  const value = String(signatureDataUrl || '').trim();
  if (!/^data:image\/png;base64,/i.test(value)) {
    throw new Error('Electronic signature is required.');
  }

  const bytes = Utilities.base64Decode(
    value.replace(/^data:image\/png;base64,/i, '')
  );
  if (!bytes.length || bytes.length > 1024 * 1024) {
    throw new Error('Electronic signature image is invalid or too large.');
  }
  return Utilities.newBlob(bytes, 'image/png', 'student-electronic-signature.png');
}

function v2AcceptancePackSubmitSigned(rawToken, data) {
  assertDevIdentity_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  const createdFiles = [];
  try {
    const tokenResult = v2ValidateAcceptanceToken_(rawToken);
    const ctx = v2AcceptancePackContext_(tokenResult.referenceNo);
    const form = data || {};

    if (form.declarationAccepted !== true) {
      throw new Error('Please confirm the admission document declaration before submitting.');
    }

    const clientName = String(form.signedName || '').replace(/\s+/g, ' ').trim();
    const masterName = String(ctx.studentName || '').replace(/\s+/g, ' ').trim();
    if (!masterName) throw new Error('Student name is missing from the admission record.');
    if (clientName && clientName.toUpperCase() !== masterName.toUpperCase()) {
      throw new Error('The signed name must match the admission record.');
    }

    if (String(ctx.workflow.record['Offer Letter Status'] || '') !== 'ISSUED') {
      throw new Error('Acceptance blocked: Offer Letter has not been issued.');
    }
    if (String(ctx.workflow.record['Acceptance Status'] || '').toUpperCase() === 'ACCEPTED') {
      throw new Error('This offer has already been accepted.');
    }

    v2AcceptancePackEnsureHeaders_();
    v2AcceptancePackEnsureReviewDocs_(ctx.referenceNo, 'Student Acceptance Submission');

    const signatureBlob = v2AcceptancePackSignatureBlob_(form.signatureDataUrl);
    const now = new Date();
    const nowIso = now.toISOString();
    const signedDate = v2AcceptancePackDate_(now);
    const safeName = v2AcceptancePackSafeName_(masterName);
    const updates = {};

    try {
      v2AcceptancePackSpecs_().forEach(function(spec) {
        const file = v2AcceptancePackCreatePdf_(ctx, spec, {
          signatureBlob: signatureBlob,
          signedDate: signedDate,
          fileName: spec.signedPrefix + safeName + '.pdf'
        });
        createdFiles.push(file);
        updates[spec.signedField] = file.getUrl();
      });


      // The Student Handbook acknowledgement must preserve the exact handbook
      // page layout. The browser composes that approved page with student data
      // and the same e-signature, then the backend stores only that signed page.
      const handbookAckFile = v2AcceptanceCreateExactHandbookAckPdf_(
        ctx,
        form.handbookAcknowledgementImageDataUrl,
        'SIGNED_Student_Handbook_Acknowledgement_' + safeName + '.pdf'
      );
      createdFiles.push(handbookAckFile);
      updates['Student Handbook Acknowledgement Signed PDF URL'] = handbookAckFile.getUrl();
    } catch (generationError) {
      createdFiles.forEach(function(file) {
        try { file.setTrashed(true); } catch (ignore) {}
      });
      throw generationError;
    }

    updates['Acceptance Signed Name'] = masterName;
    updates['Acceptance Signed At'] = nowIso;
    updates['Acceptance Pack Status'] = 'SIGNED';
    updates['Acceptance Pack Signed At'] = nowIso;
    updates['Last Updated'] = nowIso;
    updates['Updated By'] = 'Student E-Signature';

    v2UpdateRow_(ctx.workflow.sheet, ctx.workflow.rowNumber, updates);

    let accepted;
    try {
      accepted = v2AcceptOffer_(
        rawToken,
        {
          signedName: masterName,
          declarationAccepted: true
        },
        'Student Acceptance Pack E-Signature'
      );
    } catch (finalizeError) {
      createdFiles.forEach(function(file) {
        try { file.setTrashed(true); } catch (ignore) {}
      });
      v2UpdateRow_(ctx.workflow.sheet, ctx.workflow.rowNumber, {
        'Acceptance PDF URL': '',
        'Surat Penerimaan Signed PDF URL': '',
        'Surat Akuan Signed PDF URL': '',
        'Student Handbook Acknowledgement Signed PDF URL': '',
        'Acceptance Pack Status': 'SIGNATURE_FAILED',
        'Acceptance Pack Signed At': '',
        'Acceptance Signed Name': '',
        'Acceptance Signed At': '',
        'Last Updated': new Date().toISOString(),
        'Updated By': 'Acceptance Pack Rollback'
      });
      throw finalizeError;
    }

    const fresh = v2Find_('V2_WORKFLOW', 'Reference No', ctx.referenceNo);
    const reviewFields = [
      'Acceptance Review PDF URL',
      'Surat Penerimaan Review PDF URL',
      'Surat Akuan Review PDF URL',
      'Student Handbook Acknowledgement Review PDF URL'
    ];
    reviewFields.forEach(function(field) {
      v2AcceptancePackTrashUrl_(fresh.record[field]);
    });
    v2UpdateRow_(fresh.sheet, fresh.rowNumber, {
      'Acceptance Review PDF URL': '',
      'Surat Penerimaan Review PDF URL': '',
      'Surat Akuan Review PDF URL': '',
      'Student Handbook Acknowledgement Review PDF URL': '',
      'Acceptance Pack Status': 'ACCEPTED',
      'Last Updated': new Date().toISOString(),
      'Updated By': 'Student Acceptance Pack E-Signature'
    });

    v2Audit_(
      ctx.referenceNo,
      'ACCEPTANCE',
      'SIGN_ACCEPTANCE_PACK',
      {},
      {
        acceptanceStatus: 'ACCEPTED',
        signedDocuments: 4,
        signedName: masterName,
        signedAt: nowIso
      },
      'Student Acceptance Pack E-Signature',
      'SUCCESS',
      ''
    );

    v2InvalidateCache_();

    return {
      ok: true,
      referenceNo: ctx.referenceNo,
      acceptanceStatus: accepted.acceptanceStatus,
      applicationStage: accepted.applicationStage,
      signedName: masterName,
      signedAt: nowIso,
      acceptancePdfUrl: updates['Acceptance PDF URL'],
      suratPenerimaanPdfUrl: updates['Surat Penerimaan Signed PDF URL'],
      suratAkuanPdfUrl: updates['Surat Akuan Signed PDF URL'],
      handbookAcknowledgementPdfUrl: updates['Student Handbook Acknowledgement Signed PDF URL'],
      signedDocumentCount: 4,
      studentFolderUrl: ctx.studentFolder.getUrl(),
      tokenConsumed: accepted.tokenConsumed,
      v1Touched: false
    };
  } finally {
    lock.releaseLock();
  }
}

function v2AcceptancePackControlledTest() {
  assertDevIdentity_();
  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );
  const now = new Date().toISOString();
  const reference = 'V2-ACCEPTANCE-PACK-TEST-' + stamp;
  const root = DriveApp.getFolderById(CONFIG.rootFolderId);
  const testRoot = v2GetOrCreateFolder_(root, 'V2_TEST_OUTPUT');
  const studentFolder = v2GetOrCreateFolder_(testRoot, 'ACCEPTANCE_PACK_' + stamp);

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Student Name': 'V2 ACCEPTANCE PACK TEST ' + stamp,
    'ID / Passport No': 'PACK-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Part Time',
    'Intake': 'September 2026',
    'Student Folder URL': studentFolder.getUrl(),
    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_ACCEPTANCE_PACK_TEST'
  });

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': 'V2 ACCEPTANCE PACK TEST ' + stamp,
    'ID / Passport No': 'PACK-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'September 2026',
    'Application Stage': 'ELIGIBLE_FOR_OFFER',
    'Application Status': 'TEST',
    'SAC Decision': 'DIRECT_ENTRY',
    'Assessment Status': 'NOT_REQUIRED',
    'Prerequisite Status': 'NOT_REQUIRED',
    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'PENDING',
    'Student Folder URL': studentFolder.getUrl(),
    'Last Updated': now,
    'Updated By': 'Controlled Acceptance Pack Test',
    'Version': V2_BUILD
  });

  const prepared = v2PrepareOffer_(reference, 'Controlled Acceptance Pack Test');
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  v2UpdateRow_(workflow.sheet, workflow.rowNumber, {
    'Offer Letter Status': 'ISSUED',
    'Offer Letter Issued At': now,
    'Offer Letter PDF URL': 'TEST-OFFER-PDF',
    'Application Stage': 'OFFER_ISSUED',
    'Acceptance Status': 'PENDING'
  });

  const pack = v2AcceptancePackEnsureReviewDocs_(reference, 'Controlled Acceptance Pack Test');
  const tinySignature = 'data:image/png;base64,' +
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  const accepted = v2AcceptancePackSubmitSigned(
    prepared.acceptanceToken,
    {
      signedName: 'V2 ACCEPTANCE PACK TEST ' + stamp,
      signatureDataUrl: tinySignature,
      handbookAcknowledgementImageDataUrl: v2AcceptanceHandbookAckBackgroundDataUrl_(),
      declarationAccepted: true
    }
  );

  const finalWorkflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const signedUrls = [
    finalWorkflow.record['Acceptance PDF URL'],
    finalWorkflow.record['Surat Penerimaan Signed PDF URL'],
    finalWorkflow.record['Surat Akuan Signed PDF URL'],
    finalWorkflow.record['Student Handbook Acknowledgement Signed PDF URL']
  ];
  const signedPdfFilesExist = signedUrls.every(function(url) {
    const id = v2OfferExtractDriveId_(url);
    if (!id) return false;
    try {
      return DriveApp.getFileById(id).getMimeType() === MimeType.PDF;
    } catch (error) {
      return false;
    }
  });

  const checks = {
    reviewPackReady: pack && pack.ok === true && pack.documents.length === 4,
    accepted: accepted && accepted.ok === true,
    signedDocumentCount: accepted.signedDocumentCount === 4,
    signedPdfFilesExist: signedPdfFilesExist,
    finalStageAccepted: String(finalWorkflow.record['Application Stage'] || '') === 'ACCEPTED',
    acceptanceStatusAccepted: String(finalWorkflow.record['Acceptance Status'] || '') === 'ACCEPTED',
    packStatusAccepted: String(finalWorkflow.record['Acceptance Pack Status'] || '') === 'ACCEPTED',
    tokenConsumed: String(finalWorkflow.record['Acceptance Token Hash'] || '') === ''
  };

  const report = {
    ok: Object.keys(checks).every(function(key) { return checks[key] === true; }),
    referenceNo: reference,
    checks: checks,
    studentFolderUrl: studentFolder.getUrl(),
    signedUrls: signedUrls,
    emailSent: false,
    v1Touched: false
  };
  Logger.log(JSON.stringify(report));
  return report;
}
