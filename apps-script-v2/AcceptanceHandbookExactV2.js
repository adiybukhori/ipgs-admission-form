/*
 * Admission V2 - Exact Student Handbook acknowledgement support.
 *
 * Uses the exact acknowledgement page extracted from the approved
 * Postgraduate Student Handbook. The full handbook is a review/download
 * document; only the signed acknowledgement page is stored per student.
 */

const V2_HANDBOOK_PUBLIC_FILE_ID = '15k9C77Zo85f6E-DzBDbQVEr1n_zXT6rz';
const V2_HANDBOOK_ACK_EXACT_PDF_ID = '187Qr1CCI4JKfNeq5o4hljSSlddO06RcX';
const V2_HANDBOOK_ACK_EXACT_PNG_ID = '1oNMk7ed3i6PqNQVVHHRV8w7OLFXQZuwS';

function v2AcceptanceEnsureAnyoneWithLink_(fileId) {
  const file = DriveApp.getFileById(String(fileId || '').trim());
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    Logger.log('Unable to set anyone-with-link sharing for ' + fileId + ': ' + error);
  }
  return file;
}

function v2AcceptanceHandbookPublicUrl_() {
  const id = String(CONFIG.studentHandbookFileId || V2_HANDBOOK_PUBLIC_FILE_ID).trim();
  if (!id) throw new Error('Student Handbook file is not configured.');
  v2AcceptanceEnsureAnyoneWithLink_(id);
  return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view?usp=sharing';
}

function v2AcceptanceHandbookAckPublicUrl_() {
  v2AcceptanceEnsureAnyoneWithLink_(V2_HANDBOOK_ACK_EXACT_PDF_ID);
  return 'https://drive.google.com/file/d/' + encodeURIComponent(V2_HANDBOOK_ACK_EXACT_PDF_ID) + '/view?usp=sharing';
}

function v2AcceptanceHandbookAckBackgroundDataUrl_() {
  const blob = DriveApp.getFileById(V2_HANDBOOK_ACK_EXACT_PNG_ID).getBlob();
  return 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes());
}

function v2AcceptancePackImageBlob_(dataUrl, fileName) {
  const value = String(dataUrl || '').trim();
  const match = value.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('Student Handbook acknowledgement image is invalid.');
  const bytes = Utilities.base64Decode(match[2]);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw new Error('Student Handbook acknowledgement image is invalid or too large.');
  }
  const mime = String(match[1]).toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
  return Utilities.newBlob(bytes, mime, fileName || 'student-handbook-acknowledgement.png');
}

function v2AcceptanceCreateExactHandbookAckPdf_(ctx, imageDataUrl, fileName) {
  const imageBlob = v2AcceptancePackImageBlob_(
    imageDataUrl,
    'signed-student-handbook-acknowledgement.png'
  );

  const tempDoc = DocumentApp.create('V2_TEMP_HANDBOOK_ACK_' + Utilities.getUuid());
  const tempFile = DriveApp.getFileById(tempDoc.getId());
  try {
    tempFile.moveTo(ctx.studentFolder);
    const body = tempDoc.getBody();
    body.clear();
    body.setPageWidth(595.28);
    body.setPageHeight(841.89);
    body.setMarginTop(0);
    body.setMarginBottom(0);
    body.setMarginLeft(0);
    body.setMarginRight(0);

    const paragraph = body.appendParagraph('');
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    paragraph.setLineSpacing(1);
    const image = paragraph.appendInlineImage(imageBlob);
    image.setWidth(594);
    image.setHeight(840);

    tempDoc.saveAndClose();

    const pdfBlob = DriveApp.getFileById(tempFile.getId())
      .getAs(MimeType.PDF)
      .setName(fileName);
    return ctx.studentFolder.createFile(pdfBlob);
  } finally {
    try { tempFile.setTrashed(true); } catch (ignore) {}
  }
}
