/*
 * IUC LOA V1 PARITY — CONTROLLED APPS SCRIPT PATCH CANDIDATE
 * Not deployed. Wire into v2IssueOffer_ ONLY AFTER the active provider's stage gates,
 * category routing and signature/acceptance workflows have been reconciled.
 * Original V1 Docs, actual sent email and PDFs were inspected on 26 Nov 2026.
 */
const V2_LOA_V1_ORIGINAL_TEMPLATES = Object.freeze({
  offer:'1BXx6GK7XPIbw8tmF8gmeGr8KUL1opFfCmEoC1TXnxwA',
  acceptance:'1JuIwpkPXIebWohnJrBUyJLw5flbVi3nbX0IsOgYlzlg',
  penerimaan:'1-fG3WrLOIpl3yl0Mqt4Geqiw1g6FNwGJ2DvXbtXmUB4',
  akuan:'1dwVfTaHh5Zue_Ob2521ZoGHK-nwIC-WV7yK8p8m7pPc'
});

function v2LoaV1ProgrammeDisplay_(programme) {
  const text=String(programme||'').trim();
  // The raw ACC programme may contain a prefix such as "MBA -".
  // The original V1 emails use the long programme title.
  return text.replace(/^(?:MBA|MBM|DBA|PHD|PH\.D\.?|MHUM|MIS|MEDU|PGDT|DPLI)\s*[-–]\s*/i,'').trim();
}

function v2LoaV1MailContract_(programme,matricNo,programmeCode,idPassport) {
  const title=v2LoaV1ProgrammeDisplay_(programme);
  const matric=String(matricNo||'').trim();
  if(!/^\d{7}$/.test(matric))throw new Error('Registry-confirmed 7-digit SKY matric number is required.');
  const code=String(programmeCode||'').trim().toUpperCase();
  const id=String(idPassport||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  if(!/^[A-Z0-9]{2,12}$/.test(code)||!id)throw new Error('Valid programme code and ID/passport are required.');
  return {
    subject:'[Registry] Letter of Admission – '+title,
    body:[
      'Dear Candidate,',
      '',
      'Warm greetings from Innovative University College (IUC).',
      '',
      'We are pleased to inform you that you have successfully fulfilled the entry requirements for the '+title+' program at IUC. Congratulations on this significant achievement and welcome to our academic community.',
      '',
      'Attached to this email are the following important documents:',
      '',
      '- Official Offer Letter – This document confirms your successful admission and provides key information regarding your program details, registration procedures, and tuition fees.',
      '',
      '- Acceptance of Offer – Kindly review the details and return a signed copy as acknowledgment of acceptance.',
      '',
      '- Surat Akuan IUC – Kindly review the details and return a signed copy as acknowledgment of acceptance.',
      '',
      '- Surat Penerimaan Tawaran IUC – Kindly review the details and return a signed copy as acknowledgment of acceptance.',
      '',
      'To access your student account, please log in to the IUC Student Portal using the following credentials:',
      '',
      'Student Matrix No.: '+matric,
      '',
      'Portal Link: https://innovative.vialing.com/sp/login',
      '',
      'Username: Matrix Number or Email Address',
      '',
      'Password: Your IC Number (without dashes)',
      '',
      'Official Student WhatsApp Community:',
      '',
      'Please join the official IUC Student WhatsApp Community for important announcements, orientation updates, class information, and further communication from the Registry Department.',
      '',
      'Community Link: https://chat.whatsapp.com/B965syaRbyMHniDrwXmEyu',
      '',
      'Acceptance Submission:',
      '',
      'Please sign the acceptance documents and submit via this link:',
      'https://forms.gle/xvVDEnnt9Fq4jAKp7',
      '',
      'Application for Physical Student ID Card:',
      '',
      'Students who require a physical Student ID Card are kindly requested to complete the application form via the following link:',
      'https://forms.gle/rDVdXAbzenxnUEeRA',
      '',
      'Warm regards,',
      '',
      'Registry Department',
      '',
      'Innovative University College'
    ].join('\n'),
    attachmentNames:[
      'LOA_'+code+'_'+id+'.pdf',
      'Acceptance_EN_'+code+'_'+id+'.pdf',
      'Surat_Penerimaan_'+code+'_'+id+'.pdf',
      'Surat_Akuan_'+code+'_'+id+'.pdf'
    ]
  };
}

/*
 * To produce the three V1 unsigned review PDFs in the existing ACC student folder:
 * - ctx = v2AcceptancePackContext_(referenceNo), with ctx.studentFolder.
 * - Use v2AcceptancePackCreatePdf_(ctx,{code,templateId}, {fileName}) with the
 *   original V1 template IDs above; reuse any existing file of the same name.
 * - Add existing LOA PDF as the first attachment.
 * - In LIVE mode, require Registry sender alias and authorised programme-specific
 *   CC routing. Never silently fall back to another account.
 * - In TEST mode, send exclusively to authorised synthetic test recipient, no CC.
 * - Keep the existing V2_LOA_DELIVERY idempotency key, lock and UNKNOWN delivery
 *   recovery. Do not send when any attachment is missing.
 *
 * The original V1 forms and IC-based credential advice are retained in this
 * output contract solely for byte/text parity. Security approval is required
 * before using that inherited credential instruction in live emails.
 *
 * Important: this candidate contains ONLY a pure email/attachment contract.
 * The existing Apps Script v2PrepareOffer_, v2GenerateOfferLetter_,
 * AgenticBridgeV2.ISSUE_OFFER and stage transition MUST also be updated in one
 * coordinated deploy; one-file email changes alone are not an acceptable release.
 */
