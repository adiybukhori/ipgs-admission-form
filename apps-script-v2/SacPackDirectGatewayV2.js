/**
 * Direct SAC pack file gateway.
 *
 * Purpose:
 * - Serve the six approved SAC pack documents without touching any legacy
 *   admission helpers that remain protected by the DEV safety lock.
 * - Read only from the canonical V2 sheets and Drive.
 * - Authentication is enforced by Code.doPost before this function is called.
 */
function v2GetSacPackFileDirect_(data) {
  assertDevIdentity_();

  const input = data || {};
  const sessionId = String(input.sessionId || '').trim();
  const reference = String(input.referenceNo || '').trim();
  const requestedKey = String(input.documentKey || '').trim();

  if (!sessionId) throw new Error('SAC Session ID is required.');
  if (!reference) throw new Error('Reference No is required.');
  if (!requestedKey) throw new Error('Document key is required.');

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  function findRecord(sheetName, match) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return null;

    const values = sheet.getDataRange().getValues();
    const headers = values.shift().map(function(value) {
      return String(value || '').trim();
    });

    const indexes = {};
    Object.keys(match).forEach(function(header) {
      indexes[header] = headers.indexOf(header);
      if (indexes[header] < 0) {
        throw new Error('Required header is missing from ' + sheetName + ': ' + header);
      }
    });

    for (let r = 0; r < values.length; r++) {
      let matches = true;
      Object.keys(match).forEach(function(header) {
        if (String(values[r][indexes[header]] || '').trim() !== String(match[header] || '').trim()) {
          matches = false;
        }
      });
      if (!matches) continue;

      const record = {};
      headers.forEach(function(header, index) {
        record[header] = values[r][index];
      });
      return record;
    }

    return null;
  }

  function extractDriveId(value) {
    const match = String(value || '').match(/[-\w]{20,}/);
    return match ? match[0] : '';
  }

  const candidate = findRecord('V2_SAC_CANDIDATES', {
    'SAC Session ID': sessionId,
    'Reference No': reference
  });
  if (!candidate) throw new Error('Candidate is not assigned to this SAC session.');

  const application = findRecord('V2_APPLICATIONS', {
    'Reference No': reference
  });
  if (!application) throw new Error('V2 application record not found.');

  const workflow = findRecord('V2_WORKFLOW', {
    'Reference No': reference
  });

  let fileId = '';
  let canonicalKey = requestedKey;

  if (requestedKey === 'admissionForm') {
    fileId = extractDriveId(
      application['Admission Form PDF URL'] ||
      (workflow && workflow['Admission Form PDF URL']) ||
      ''
    );

  } else if (requestedKey === 'pgAdm01' || requestedKey === 'form01') {
    canonicalKey = 'pgAdm01';
    fileId = extractDriveId(
      candidate['Form 01 URL'] ||
      (workflow && (workflow['PG-ADM-01 URL'] || workflow['PG-ADM-01 Form URL'])) ||
      ''
    );

  } else if (requestedKey === 'aiScreeningReport') {
    const ai = findRecord('V2_AI_SCREENING', {
      'Reference No': reference
    });
    if (ai) {
      const reportStatus = String(ai['Report Status'] || '').trim().toUpperCase();
      if (reportStatus === 'FINAL' || reportStatus === 'FINAL_WITH_FLAGS') {
        fileId = String(ai['Report File ID'] || extractDriveId(ai['Report PDF URL'] || '') || '').trim();
      }
    }

  } else {
    const fieldMap = {
      certificate: 'certificate',
      transcript: 'transcript',
      resume: 'cvResume',
      cvResume: 'cvResume'
    };
    const targetField = fieldMap[requestedKey] || '';

    if (targetField) {
      canonicalKey = targetField === 'cvResume' ? 'resume' : targetField;
      let uploaded = [];
      try {
        uploaded = JSON.parse(String(application['Uploaded Files JSON'] || '[]'));
      } catch (_) {
        uploaded = [];
      }
      if (!Array.isArray(uploaded)) uploaded = [];

      const match = uploaded.filter(function(doc) {
        return String(doc && doc.field || '').trim() === targetField;
      })[0];

      if (match) {
        fileId = String(match.fileId || extractDriveId(match.url || '') || '').trim();
      }
    }
  }

  if (!fileId) {
    throw new Error('Requested SAC pack document was not found: ' + requestedKey + '.');
  }

  const file = DriveApp.getFileById(fileId);
  const mime = String(file.getMimeType() || file.getBlob().getContentType() || 'application/octet-stream');
  const blob = file.getBlob();
  const bytes = blob.getBytes();

  return {
    ok: true,
    sessionId: sessionId,
    referenceNo: reference,
    documentKey: canonicalKey,
    requestedDocumentKey: requestedKey,
    fileName: String(file.getName() || 'document'),
    mimeType: mime,
    base64: Utilities.base64Encode(bytes),
    size: bytes.length,
    source: 'DIRECT_V2_GATEWAY',
    v1Touched: false
  };
}

/**
 * Read-only controlled UAT against the one-candidate SAC session used for the
 * production repair. Returns metadata only so execution logs do not contain
 * document bytes.
 */
function v2SacPackDirectGatewayControlledTest() {
  assertDevIdentity_();

  const common = {
    sessionId: 'SAC-20260929-F1B9E8',
    referenceNo: 'IUC-ADM-V2-20260927-122229-89082203-95D5'
  };

  function check(key) {
    const result = v2GetSacPackFileDirect_({
      sessionId: common.sessionId,
      referenceNo: common.referenceNo,
      documentKey: key
    });
    return {
      ok: result.ok === true,
      documentKey: result.documentKey,
      requestedDocumentKey: result.requestedDocumentKey,
      fileName: result.fileName,
      mimeType: result.mimeType,
      size: result.size,
      source: result.source
    };
  }

  return {
    ok: true,
    admissionForm: check('admissionForm'),
    certificate: check('certificate'),
    aiScreeningReport: check('aiScreeningReport')
  };
}
