// Admission V2 large-file transport.
// Files are uploaded to the existing Apps Script backend in small chunks,
// then the final admission request contains metadata only. This keeps each
// Vercel Function request comfortably below the platform payload limit.
(function () {
  'use strict';

  const CHUNK_SIZE = 1024 * 1024; // 1 MiB raw ~= 1.34 MiB base64.
  const legacyBuildPayload = buildPayload;

  function makeUploadId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const random = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return Date.now().toString(36) + '-' + random;
  }

  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const stride = 0x8000;
    for (let i = 0; i < bytes.length; i += stride) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + stride, bytes.length)));
    }
    return btoa(binary);
  }

  async function postUploadChunk(data) {
    const response = await fetch('/api/admission', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'v2SubmitAdmission',
        data: Object.assign({ __admissionUploadChunk: true }, data)
      })
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (_) {
      result = { ok: false, message: text || 'Invalid upload response.' };
    }

    if (!response.ok || !result || !result.ok) {
      throw new Error((result && result.message) || 'Document upload failed.');
    }
    return result;
  }

  async function uploadDocument(key, file, position, total) {
    const uploadId = makeUploadId();
    const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const mimeType = file.type || 'application/octet-stream';

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const base64 = bufferToBase64(await slice.arrayBuffer());

      if (typeof setStatus === 'function') {
        setStatus('info', `
          <div class="submit-progress-wrap">
            <div class="submit-progress-title">Uploading documents...</div>
            <div class="small">Document ${position} of ${total} · Part ${chunkIndex + 1} of ${chunkCount}</div>
            <div class="submit-progress-track"><div class="submit-progress-fill"></div></div>
          </div>
        `);
      }

      await postUploadChunk({
        uploadId,
        field: key,
        fileName: file.name,
        mimeType,
        size: file.size,
        chunkIndex,
        chunkCount,
        base64
      });
    }

    return {
      fileName: file.name,
      mimeType,
      size: file.size,
      stagedUploadId: uploadId,
      chunkCount
    };
  }

  buildPayload = async function buildPayloadWithChunkedUploads() {
    // The Apps Script-hosted copy uses google.script.run and is not subject
    // to Vercel's request-body limit, so retain the proven legacy path there.
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return legacyBuildPayload();
    }

    const selected = fileKeys
      .map(key => ({ key, file: formState.documents[key] }))
      .filter(item => !!item.file);

    const documents = {};
    for (let i = 0; i < selected.length; i += 1) {
      const item = selected[i];
      documents[item.key] = await uploadDocument(item.key, item.file, i + 1, selected.length);
    }

    const payload = JSON.parse(JSON.stringify(formState));
    payload.isTransferApplicant = formState.applicationCategory === 'Transfer Student';
    payload.documents = documents;
    payload.meta = {
      submittedAt: new Date().toISOString(),
      source: 'IUC Admission Standalone Frontend',
      userAgent: navigator.userAgent,
      uploadTransport: 'chunked-v2-20261006'
    };

    if (typeof setStatus === 'function') {
      setStatus('info', `
        <div class="submit-progress-wrap">
          <div class="submit-progress-title">Finalising your application...</div>
          <div class="small">Your documents are uploaded. Please wait while the admission record is being generated.</div>
          <div class="submit-progress-track"><div class="submit-progress-fill"></div></div>
        </div>
      `);
    }
    return payload;
  };
})();
