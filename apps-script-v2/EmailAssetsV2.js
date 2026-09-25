/**
 * Email visual assets for Admission V2.
 * Official IUC + IPGS email header supplied by the Registrar Office.
 *
 * Stored as a Drive asset instead of Base64 so the image cannot be truncated
 * during source deployment.
 */
const V2_EMAIL_HEADER_FILE_ID = '1UjawHn82H0pfMTSW3ihMSLxgxSjKrV3x';

function v2AdmissionEmailHeaderBlob_() {
  try {
    return DriveApp.getFileById(V2_EMAIL_HEADER_FILE_ID)
      .getBlob()
      .setName('IPGS_Official_Email_Header.jpg');
  } catch (error) {
    Logger.log('Unable to load official IPGS email header: ' + String(error && error.message || error));
    return null;
  }
}
