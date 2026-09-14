from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
pack_path = ROOT / 'apps-script-v2' / 'AcceptancePackV2.js'
html_path = ROOT / 'apps-script-v2' / 'acceptance-v2.html'


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Marker not found for {label}')
    return text.replace(old, new, 1)

pack = pack_path.read_text(encoding='utf-8')

pack = replace_once(
    pack,
    "  suratAkuan: '1dwVfTaHh5Zue_Ob2521ZoGHK-nwIC-WV7yK8p8m7pPc',\n  studentHandbook: '1qXyo_oxIleMhTALZbl955G6XIR0VvbB1'",
    "  suratAkuan: '1dwVfTaHh5Zue_Ob2521ZoGHK-nwIC-WV7yK8p8m7pPc',\n  studentHandbook: '1qXyo_oxIleMhTALZbl955G6XIR0VvbB1',\n  handbookAcknowledgement: '1gOCTcpm6TdDMExgSTuTtACGSciXxYo7CeGvV7amfJ_k'",
    'handbook acknowledgement template fallback'
)

pack = replace_once(
    pack,
    "  'Surat Akuan Review PDF URL',\n  'Student Handbook URL',\n  'Surat Penerimaan Signed PDF URL',\n  'Surat Akuan Signed PDF URL',",
    "  'Surat Akuan Review PDF URL',\n  'Student Handbook Acknowledgement Review PDF URL',\n  'Student Handbook URL',\n  'Surat Penerimaan Signed PDF URL',\n  'Surat Akuan Signed PDF URL',\n  'Student Handbook Acknowledgement Signed PDF URL',",
    'workflow headers'
)

pack = replace_once(
    pack,
    "    studentHandbook: String(\n      CONFIG.studentHandbookFileId ||\n      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.studentHandbook\n    ).trim()\n  };",
    "    studentHandbook: String(\n      CONFIG.studentHandbookFileId ||\n      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.studentHandbook\n    ).trim(),\n    handbookAcknowledgement: String(\n      CONFIG.studentHandbookAcknowledgementTemplateId ||\n      V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.handbookAcknowledgement\n    ).trim()\n  };",
    'template id resolver'
)

pack = replace_once(
    pack,
    "    '{{SESSION_MONTH}}': my.month,\n    '{{SESSION_YEAR}}': my.year",
    "    '{{SESSION_MONTH}}': my.month,\n    '{{SESSION_YEAR}}': my.year,\n    '{{SIGNED_DATE}}': ''",
    'signed date placeholder'
)

pack = replace_once(
    pack,
    "  throw new Error('Unsupported acceptance document type: ' + docType);",
    "  if (docType === 'HANDBOOK_ACKNOWLEDGEMENT') {\n    const signaturePara = v2AcceptancePackFindParagraph_(body, [\n      'Student’s Signature',\n      \"Student's Signature\"\n    ]);\n    if (!signaturePara) {\n      throw new Error('Student Handbook acknowledgement signature field was not found in the approved template.');\n    }\n    v2AcceptancePackAppendSignature_(signaturePara, 'Student’s Signature :', signatureBlob);\n\n    const datePara = v2AcceptancePackFindParagraph_(body, ['Date:']);\n    if (datePara) {\n      datePara.clear();\n      datePara.appendText('Date : ' + signedDate);\n    }\n    return;\n  }\n\n  throw new Error('Unsupported acceptance document type: ' + docType);",
    'handbook acknowledgement signature handling'
)

pack = replace_once(
    pack,
    "      reviewPrefix: 'REVIEW_Surat_Akuan_',\n      signedPrefix: 'SIGNED_Surat_Akuan_'\n    }\n  ];",
    "      reviewPrefix: 'REVIEW_Surat_Akuan_',\n      signedPrefix: 'SIGNED_Surat_Akuan_'\n    },\n    {\n      code: 'HANDBOOK_ACKNOWLEDGEMENT',\n      label: 'Student Handbook Acknowledgement',\n      templateId: ids.handbookAcknowledgement,\n      reviewField: 'Student Handbook Acknowledgement Review PDF URL',\n      signedField: 'Student Handbook Acknowledgement Signed PDF URL',\n      reviewPrefix: 'REVIEW_Student_Handbook_Acknowledgement_',\n      signedPrefix: 'SIGNED_Student_Handbook_Acknowledgement_'\n    }\n  ];",
    'handbook acknowledgement spec'
)

pack = replace_once(
    pack,
    "  if (pack.handbookUrl) docs.push({\n    code: 'STUDENT_HANDBOOK',\n    label: 'Postgraduate Student Handbook',\n    url: pack.handbookUrl,\n    signRequired: false\n  });",
    "  if (pack.handbookUrl) {\n    const handbookId = v2OfferExtractDriveId_(pack.handbookUrl);\n    docs.push({\n      code: 'STUDENT_HANDBOOK',\n      label: 'Postgraduate Student Handbook',\n      url: handbookId\n        ? 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(handbookId)\n        : pack.handbookUrl,\n      signRequired: false,\n      downloadOnly: true\n    });\n  }",
    'handbook download document'
)

pack = replace_once(
    pack,
    "      suratPenerimaan: String(ctx.workflow.record['Surat Penerimaan Signed PDF URL'] || ''),\n      suratAkuan: String(ctx.workflow.record['Surat Akuan Signed PDF URL'] || '')",
    "      suratPenerimaan: String(ctx.workflow.record['Surat Penerimaan Signed PDF URL'] || ''),\n      suratAkuan: String(ctx.workflow.record['Surat Akuan Signed PDF URL'] || ''),\n      handbookAcknowledgement: String(ctx.workflow.record['Student Handbook Acknowledgement Signed PDF URL'] || '')",
    'signed documents response'
)

pack = replace_once(
    pack,
    "        'Surat Penerimaan Signed PDF URL': '',\n        'Surat Akuan Signed PDF URL': '',",
    "        'Surat Penerimaan Signed PDF URL': '',\n        'Surat Akuan Signed PDF URL': '',\n        'Student Handbook Acknowledgement Signed PDF URL': '',",
    'rollback signed acknowledgement'
)

pack = replace_once(
    pack,
    "      'Acceptance Review PDF URL',\n      'Surat Penerimaan Review PDF URL',\n      'Surat Akuan Review PDF URL'\n    ];",
    "      'Acceptance Review PDF URL',\n      'Surat Penerimaan Review PDF URL',\n      'Surat Akuan Review PDF URL',\n      'Student Handbook Acknowledgement Review PDF URL'\n    ];",
    'review cleanup fields'
)

pack = replace_once(
    pack,
    "      'Acceptance Review PDF URL': '',\n      'Surat Penerimaan Review PDF URL': '',\n      'Surat Akuan Review PDF URL': '',",
    "      'Acceptance Review PDF URL': '',\n      'Surat Penerimaan Review PDF URL': '',\n      'Surat Akuan Review PDF URL': '',\n      'Student Handbook Acknowledgement Review PDF URL': '',",
    'review cleanup updates'
)

pack = pack.replace("signedDocuments: 3,", "signedDocuments: 4,", 1)

pack = replace_once(
    pack,
    "      suratAkuanPdfUrl: updates['Surat Akuan Signed PDF URL'],\n      signedDocumentCount: 3,",
    "      suratAkuanPdfUrl: updates['Surat Akuan Signed PDF URL'],\n      handbookAcknowledgementPdfUrl: updates['Student Handbook Acknowledgement Signed PDF URL'],\n      signedDocumentCount: 4,",
    'submission return count'
)

pack = replace_once(
    pack,
    "    finalWorkflow.record['Acceptance PDF URL'],\n    finalWorkflow.record['Surat Penerimaan Signed PDF URL'],\n    finalWorkflow.record['Surat Akuan Signed PDF URL']",
    "    finalWorkflow.record['Acceptance PDF URL'],\n    finalWorkflow.record['Surat Penerimaan Signed PDF URL'],\n    finalWorkflow.record['Surat Akuan Signed PDF URL'],\n    finalWorkflow.record['Student Handbook Acknowledgement Signed PDF URL']",
    'controlled test signed urls'
)

pack = replace_once(
    pack,
    "    reviewPackReady: pack && pack.ok === true && pack.documents.length === 3,\n    accepted: accepted && accepted.ok === true,\n    signedDocumentCount: accepted.signedDocumentCount === 3,",
    "    reviewPackReady: pack && pack.ok === true && pack.documents.length === 4,\n    accepted: accepted && accepted.ok === true,\n    signedDocumentCount: accepted.signedDocumentCount === 4,",
    'controlled test counts'
)

pack_path.write_text(pack, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')

html = replace_once(
    html,
    "<div class=\"pack-note\">You sign only once on this page. The same electronic signature will be placed into the approved signature fields of the Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran and Surat Akuan. Signed PDFs will be saved in your admission folder.</div>",
    "<div class=\"pack-note\">You sign only once on this page. The same electronic signature will be placed into the approved signature fields of the Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran, Surat Akuan and Student Handbook Acknowledgement. The full Postgraduate Student Handbook is provided for you to download and keep; only the signed acknowledgement page is saved in your admission folder.</div>",
    'acceptance pack note'
)

html = replace_once(
    html,
    "including the Offer Letter, Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran, Surat Akuan and Student Handbook. I accept the offer and agree that my electronic signature may be applied to the documents that require my signature.",
    "including the Offer Letter, Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran, Surat Akuan, Student Handbook Acknowledgement and the full Postgraduate Student Handbook. I accept the offer, acknowledge that I have reviewed the Student Handbook, and agree that my electronic signature may be applied to the documents that require my signature.",
    'acceptance declaration'
)

html = replace_once(
    html,
    "<p>Your signed Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran and Surat Akuan have been generated and saved in your admission folder.</p>",
    "<p>Your signed Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran, Surat Akuan and Student Handbook Acknowledgement have been generated and saved in your admission folder.</p>",
    'acceptance success message'
)

html = replace_once(
    html,
    "    const link=doc.url?`<a class=\"doc-open\" target=\"_blank\" rel=\"noopener\" href=\"${escapeAttr(doc.url)}\">Open</a>`:'<span class=\"doc-open\" style=\"opacity:.45\">Unavailable</span>';",
    "    const actionLabel=doc.downloadOnly?'Download Handbook':'Open';\n    const link=doc.url?`<a class=\"doc-open\" target=\"_blank\" rel=\"noopener\" href=\"${escapeAttr(doc.url)}\">${actionLabel}</a>`:'<span class=\"doc-open\" style=\"opacity:.45\">Unavailable</span>';",
    'handbook download button'
)

html_path.write_text(html, encoding='utf-8')

print('Handbook acknowledgement integration applied.')
