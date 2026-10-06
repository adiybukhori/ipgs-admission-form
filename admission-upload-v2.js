// Admission V2 durable large-file transport.
// Every chunk is safety-buffered server-side before the form can be acknowledged.
// The same submission key is reused across retries to prevent duplicate applications.
(function () {
  'use strict';

  const CHUNK_SIZE = 1024 * 1024; // 1 MiB raw ~= 1.34 MiB base64.
  const legacyBuildPayload = buildPayload;

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const random = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return Date.now().toString(36) + '-' + random;
  }

  function getSubmissionKey() {
    const keyName = 'iuc_admission_submission_key';
    try {
      let value = sessionStorage.getItem(keyName);
      if (!value) {
        value = makeId();
        sessionStorage.setItem(keyName, value);
      }
      return value;
    } catch (_) {
      if (!window.__iucAdmissionSubmissionKey) window.__iucAdmissionSubmissionKey = makeId();
      return window.__iucAdmissionSubmissionKey;
    }
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
      result = { ok: false, message: 'We could not securely receive this document. Please try again.' };
    }

    if (!response.ok || !result || !result.ok || !result.securelyReceived) {
      throw new Error('We could not securely receive one of your documents. Please try again.');
    }
    return result;
  }

  async function uploadDocument(key, file, position, total) {
    const uploadId = makeId();
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
            <div class="submit-progress-title">Securing your documents...</div>
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

  buildPayload = async function buildPayloadWithDurableUploads() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return legacyBuildPayload();
    }

    const submissionKey = getSubmissionKey();
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
      uploadTransport: 'durable-supabase-v3-20261006',
      submissionKey
    };

    if (typeof setStatus === 'function') {
      setStatus('info', `
        <div class="submit-progress-wrap">
          <div class="submit-progress-title">Confirming your application...</div>
          <div class="small">Your information and documents are being securely confirmed.</div>
          <div class="submit-progress-track"><div class="submit-progress-fill"></div></div>
        </div>
      `);
    }
    return payload;
  };

  window.addEventListener('pageshow', function () {
    // Deliberately keep the same session key after refresh/back navigation.
    // This makes retries idempotent instead of creating duplicate applications.
    getSubmissionKey();
  });
})();
