/**
 * Admission V2 staged/chunked document upload transport.
 * Keeps browser -> Vercel requests below the Vercel Function payload limit.
 */
const V2_ADMISSION_UPLOAD_STAGING_FOLDER = 'V2_UPLOAD_STAGING';
const V2_ADMISSION_UPLOAD_MAX_CHUNK_BYTES = 1200 * 1024;
const V2_ADMISSION_UPLOAD_MAX_CHUNKS = 10;
const V2_ADMISSION_UPLOAD_META_FILE = 'UPLOAD_META.json';

function v2AdmissionDocumentPayloadPresent_(doc) {
  return !!(doc && (String(doc.base64 || '').trim() || String(doc.stagedUploadId || '').trim()));
}

function v2ValidateAdmissionDocumentDescriptor_(key, doc) {
  if (!doc) return;
  const size = Number(doc.size || 0);
  const mimeType = String(doc.mimeType || '');
  if (size < 1 || size > V2_MAX_DOCUMENT_BYTES) {
    throw new Error('Invalid document size for ' + key + '.');
  }
  if (V2_ALLOWED_MIME_TYPES.indexOf(mimeType) < 0) {
    throw new Error('Unsupported document type for ' + key + '.');
  }
  if (doc.base64) return;

  const uploadId = v2AdmissionUploadId_(doc.stagedUploadId);
  const chunkCount = Number(doc.chunkCount || 0);
  if (!uploadId || chunkCount < 1 || chunkCount > V2_ADMISSION_UPLOAD_MAX_CHUNKS) {
    throw new Error('Invalid staged upload for ' + key + '.');
  }
}

function v2AdmissionUploadId_(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(id)) {
    throw new Error('Invalid upload identifier.');
  }
  return id;
}

function v2AdmissionUploadStagingRoot_() {
  const root = DriveApp.getFolderById(CONFIG.rootFolderId);
  return v2GetOrCreateFolder_(root, V2_ADMISSION_UPLOAD_STAGING_FOLDER);
}

function v2AdmissionUploadFolder_(uploadId, createIfMissing) {
  const id = v2AdmissionUploadId_(uploadId);
  const root = v2AdmissionUploadStagingRoot_();
  const name = 'UPLOAD_' + id;
  const folders = root.getFoldersByName(name);
  if (folders.hasNext()) {
    const folder = folders.next();
    if (folders.hasNext()) throw new Error('Ambiguous upload staging folder.');
    return folder;
  }
  if (!createIfMissing) throw new Error('Staged upload not found. Please upload the document again.');
  return root.createFolder(name);
}

function v2AdmissionUploadReadMeta_(folder) {
  const files = folder.getFilesByName(V2_ADMISSION_UPLOAD_META_FILE);
  if (!files.hasNext()) return null;
  const file = files.next();
  if (files.hasNext()) throw new Error('Ambiguous upload metadata.');
  try {
    return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  } catch (_) {
    throw new Error('Invalid upload metadata.');
  }
}

function v2AdmissionUploadWriteMeta_(folder, meta) {
  const files = folder.getFilesByName(V2_ADMISSION_UPLOAD_META_FILE);
  while (files.hasNext()) files.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(
    JSON.stringify(meta),
    'application/json',
    V2_ADMISSION_UPLOAD_META_FILE
  ));
}

function v2AdmissionUploadChunkName_(index) {
  return 'CHUNK_' + ('000' + Number(index)).slice(-3) + '.bin';
}

function v2UploadAdmissionChunk_(payload) {
  assertDevIdentity_();
  const data = payload || {};
  const uploadId = v2AdmissionUploadId_(data.uploadId);
  const field = String(data.field || '').trim();
  const fileName = String(data.fileName || '').trim();
  const mimeType = String(data.mimeType || '').trim();
  const size = Number(data.size || 0);
  const chunkIndex = Number(data.chunkIndex);
  const chunkCount = Number(data.chunkCount);
  const base64 = String(data.base64 || '');

  if (!field || !fileName) throw new Error('Upload field and file name are required.');
  if (size < 1 || size > V2_MAX_DOCUMENT_BYTES) throw new Error('Document exceeds the allowed size.');
  if (V2_ALLOWED_MIME_TYPES.indexOf(mimeType) < 0) throw new Error('Unsupported document type.');
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) throw new Error('Invalid upload chunk index.');
  if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > V2_ADMISSION_UPLOAD_MAX_CHUNKS) {
    throw new Error('Invalid upload chunk count.');
  }
  if (chunkIndex >= chunkCount) throw new Error('Upload chunk index is out of range.');
  if (!base64) throw new Error('Upload chunk is empty.');

  let bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (_) {
    throw new Error('Upload chunk is not valid base64 data.');
  }
  if (!bytes.length || bytes.length > V2_ADMISSION_UPLOAD_MAX_CHUNK_BYTES) {
    throw new Error('Upload chunk size is invalid.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const folder = v2AdmissionUploadFolder_(uploadId, true);
    const existingMeta = v2AdmissionUploadReadMeta_(folder);
    const expectedMeta = {
      uploadId:uploadId,
      field:field,
      fileName:fileName,
      mimeType:mimeType,
      size:size,
      chunkCount:chunkCount
    };

    if (existingMeta) {
      ['uploadId','field','fileName','mimeType','size','chunkCount'].forEach(function(key) {
        if (String(existingMeta[key]) !== String(expectedMeta[key])) {
          throw new Error('Upload metadata changed during transfer. Please upload the document again.');
        }
      });
    } else {
      expectedMeta.createdAt = new Date().toISOString();
      v2AdmissionUploadWriteMeta_(folder, expectedMeta);
    }

    const chunkName = v2AdmissionUploadChunkName_(chunkIndex);
    const oldChunks = folder.getFilesByName(chunkName);
    while (oldChunks.hasNext()) oldChunks.next().setTrashed(true);
    folder.createFile(Utilities.newBlob(bytes, 'application/octet-stream', chunkName));

    return {
      ok:true,
      success:true,
      uploadId:uploadId,
      chunkIndex:chunkIndex,
      chunkCount:chunkCount,
      receivedBytes:bytes.length
    };
  } finally {
    lock.releaseLock();
  }
}

function v2MaterializeStagedAdmissionDocument_(studentFolder, key, doc, payload) {
  v2ValidateAdmissionDocumentDescriptor_(key, doc);
  const uploadId = v2AdmissionUploadId_(doc.stagedUploadId);
  const stageFolder = v2AdmissionUploadFolder_(uploadId, false);
  const meta = v2AdmissionUploadReadMeta_(stageFolder);
  if (!meta) throw new Error('Upload metadata is missing for ' + key + '.');

  const expected = {
    uploadId:uploadId,
    field:String(key || ''),
    fileName:String(doc.fileName || ''),
    mimeType:String(doc.mimeType || ''),
    size:Number(doc.size || 0),
    chunkCount:Number(doc.chunkCount || 0)
  };
  ['uploadId','field','fileName','mimeType','size','chunkCount'].forEach(function(name) {
    if (String(meta[name]) !== String(expected[name])) {
      throw new Error('Staged upload verification failed for ' + key + '.');
    }
  });

  const byteParts = [];
  for (let i = 0; i < expected.chunkCount; i += 1) {
    const files = stageFolder.getFilesByName(v2AdmissionUploadChunkName_(i));
    if (!files.hasNext()) throw new Error('Upload is incomplete for ' + key + '.');
    const file = files.next();
    if (files.hasNext()) throw new Error('Duplicate upload chunk detected for ' + key + '.');
    byteParts.push(file.getBlob().getBytes());
  }
  const allBytes = [].concat.apply([], byteParts);
  if (allBytes.length !== expected.size) {
    throw new Error('Uploaded document size verification failed for ' + key + '.');
  }

  const extension = v2DocumentExtension_(doc.fileName, doc.mimeType);
  const targetName = v2SafeName_(key).toUpperCase() + '_' +
    v2SafeName_(payload.fullName).toUpperCase() + extension;
  const blob = Utilities.newBlob(allBytes, doc.mimeType, targetName);
  const file = studentFolder.createFile(blob);
  return {
    field:key,
    fileName:file.getName(),
    url:file.getUrl(),
    mimeType:doc.mimeType,
    size:expected.size
  };
}

function v2CleanupPayloadStagedUploads_(payload) {
  const seen = {};
  const documents = payload && payload.documents ? payload.documents : {};
  Object.keys(documents).forEach(function(key) {
    const doc = documents[key] || {};
    if (!doc.stagedUploadId) return;
    const uploadId = v2AdmissionUploadId_(doc.stagedUploadId);
    if (seen[uploadId]) return;
    seen[uploadId] = true;
    try {
      v2AdmissionUploadFolder_(uploadId, false).setTrashed(true);
    } catch (error) {
      Logger.log('Admission upload staging cleanup failed for ' + uploadId + ': ' + String(error && error.message || error));
    }
  });
}
