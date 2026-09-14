from pathlib import Path


def replace_block(text: str, start_marker: str, end_marker: str, replacement: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'Missing start marker: {start_marker}')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'Missing end marker: {end_marker}')
    return text[:start] + replacement.rstrip() + '\n\n' + text[end:]


acceptance_path = Path('apps-script-v2/AcceptancePackV2.js')
acceptance = acceptance_path.read_text(encoding='utf-8')

new_acceptance_helpers = r'''function v2AcceptancePackAppendSignature_(paragraph, label, signatureBlob, width, height) {
  paragraph.clear();
  if (label) paragraph.appendText(label + ' ');
  const image = paragraph.appendInlineImage(signatureBlob.copyBlob());
  image.setWidth(Number(width || 120));
  image.setHeight(Number(height || 40));
  paragraph.setSpacingAfter(0);
  return paragraph;
}

function v2AcceptancePackFindTableCell_(body, needles) {
  const list = Array.isArray(needles) ? needles : [needles];
  const tables = body.getTables();
  for (let t = 0; t < tables.length; t += 1) {
    const table = tables[t];
    for (let r = 0; r < table.getNumRows(); r += 1) {
      const row = table.getRow(r);
      for (let c = 0; c < row.getNumCells(); c += 1) {
        const cell = row.getCell(c);
        const text = String(cell.getText() || '').trim();
        for (let n = 0; n < list.length; n += 1) {
          if (text.indexOf(list[n]) > -1) {
            return {table: table, rowIndex: r, columnIndex: c, cell: cell};
          }
        }
      }
    }
  }
  return null;
}

function v2AcceptancePackSetCellText_(cell, value) {
  cell.clear();
  const paragraph = cell.appendParagraph(String(value || ''));
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  return paragraph;
}

function v2AcceptancePackSetCellSignature_(cell, prefix, signatureBlob, width, height) {
  cell.clear();
  const paragraph = cell.appendParagraph(String(prefix || ''));
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  const image = paragraph.appendInlineImage(signatureBlob.copyBlob());
  image.setWidth(Number(width || 110));
  image.setHeight(Number(height || 36));
  return paragraph;
}

function v2AcceptancePackRemoveTrailingLine_(paragraph) {
  const text = paragraph.editAsText();
  text.replaceText('[_…\\.]{5,}\\s*$', '');
  return paragraph;
}

function v2AcceptancePackReplaceTrailingLine_(paragraph, replacement) {
  const current = String(paragraph.getText() || '');
  if (/[_…\.]{5,}/.test(current)) {
    paragraph.editAsText().replaceText('[_…\\.]{5,}', String(replacement || ''));
  } else {
    paragraph.appendText(String(replacement || ''));
  }
  return paragraph;
}

function v2AcceptancePackApplySignature_(body, docType, signatureBlob, signedName, signedDate) {
  if (docType === 'ACCEPTANCE_EN') {
    // The approved template uses a 2-column table where the label is already
    // in column 1 and the colon/value is in column 2. Only write into the
    // value cell so we never create a duplicate colon or disturb alignment.
    const signatureLabel = v2AcceptancePackFindTableCell_(body, [
      'Student’s Signature',
      "Student's Signature"
    ]);
    if (!signatureLabel) {
      throw new Error('Acceptance signature field was not found in the approved template.');
    }
    const signatureRow = signatureLabel.table.getRow(signatureLabel.rowIndex);
    if (signatureLabel.columnIndex + 1 >= signatureRow.getNumCells()) {
      throw new Error('Acceptance signature value cell was not found in the approved template.');
    }
    v2AcceptancePackSetCellSignature_(
      signatureRow.getCell(signatureLabel.columnIndex + 1),
      ': ',
      signatureBlob,
      110,
      36
    );

    const dateLabel = v2AcceptancePackFindTableCell_(body, ['Date']);
    if (!dateLabel) {
      throw new Error('Acceptance date field was not found in the approved template.');
    }
    const dateRow = dateLabel.table.getRow(dateLabel.rowIndex);
    if (dateLabel.columnIndex + 1 >= dateRow.getNumCells()) {
      throw new Error('Acceptance date value cell was not found in the approved template.');
    }
    v2AcceptancePackSetCellText_(
      dateRow.getCell(dateLabel.columnIndex + 1),
      ': ' + signedDate
    );
    return;
  }

  if (docType === 'SURAT_PENERIMAAN') {
    // Preserve the approved tabs/colon from the master. Remove only the
    // underline and append the student signature at the existing position.
    const signaturePara = v2AcceptancePackFindParagraph_(body, ['Tandatangan Pelajar']);
    if (!signaturePara) {
      throw new Error('Surat Penerimaan signature field was not found in the approved template.');
    }
    v2AcceptancePackRemoveTrailingLine_(signaturePara);
    const signatureImage = signaturePara.appendInlineImage(signatureBlob.copyBlob());
    signatureImage.setWidth(105);
    signatureImage.setHeight(34);
    signaturePara.setSpacingAfter(0);

    const datePara = v2AcceptancePackFindParagraph_(body, ['Tarikh']);
    if (!datePara) {
      throw new Error('Surat Penerimaan date field was not found in the approved template.');
    }
    v2AcceptancePackReplaceTrailingLine_(datePara, signedDate);
    return;
  }

  if (docType === 'SURAT_AKUAN') {
    // The master contains a 3-column witness table. Only touch the student
    // column. A compact signature prevents the table from spilling to a
    // second page (which previously caused the first row/signature to repeat).
    const studentCellRef = v2AcceptancePackFindTableCell_(body, ['Yang Benar']);
    if (!studentCellRef) {
      throw new Error('Surat Akuan student signature cell was not found in the approved template.');
    }

    const studentCell = studentCellRef.cell;
    let signaturePara = null;
    for (let i = 0; i < studentCell.getNumChildren(); i += 1) {
      const child = studentCell.getChild(i);
      if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      const para = child.asParagraph();
      const text = String(para.getText() || '').trim();
      if (/^[…\.]{5,}$/.test(text) || text.indexOf('……………………') > -1) {
        signaturePara = para;
        break;
      }
    }
    if (!signaturePara) signaturePara = studentCell.appendParagraph('');
    signaturePara.clear();
    const signatureImage = signaturePara.appendInlineImage(signatureBlob.copyBlob());
    signatureImage.setWidth(96);
    signatureImage.setHeight(31);
    signaturePara.setSpacingBefore(0);
    signaturePara.setSpacingAfter(0);

    // Keep the witness block untouched. Put the student date in row 2 of the
    // student column so the first row stays compact and does not repeat.
    const dateRowIndex = studentCellRef.rowIndex + 1;
    if (dateRowIndex < studentCellRef.table.getNumRows()) {
      const dateRow = studentCellRef.table.getRow(dateRowIndex);
      const dateCell = dateRow.getCell(studentCellRef.columnIndex);
      v2AcceptancePackSetCellText_(dateCell, 'Tarikh: ' + signedDate + '\nTandatangan');
    }
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
    v2AcceptancePackAppendSignature_(signaturePara, 'Student’s Signature :', signatureBlob, 110, 36);

    const datePara = v2AcceptancePackFindParagraph_(body, ['Date:']);
    if (datePara) {
      datePara.clear();
      datePara.appendText('Date : ' + signedDate);
    }
    return;
  }

  throw new Error('Unsupported acceptance document type: ' + docType);
}
'''

acceptance = replace_block(
    acceptance,
    'function v2AcceptancePackAppendSignature_',
    'function v2AcceptancePackCreatePdf_',
    new_acceptance_helpers,
)
acceptance_path.write_text(acceptance, encoding='utf-8')

pg_path = Path('apps-script-v2/PgEligibilityV2.js')
pg = pg_path.read_text(encoding='utf-8')
old_intake = "const intake = String(app['Intake'] || '').trim();"
new_intake = "const intake = v2OfferDisplayIntake_(app['Intake'] || '');"
if old_intake in pg:
    pg = pg.replace(old_intake, new_intake, 1)
elif new_intake not in pg:
    raise SystemExit('PG-ADM-01 intake assignment marker not found')

old_footer = "'<div class=\"footer\">Controlled Document&nbsp;&nbsp;|&nbsp;&nbsp;Internal Use' + (sessionId ? '&nbsp;&nbsp;|&nbsp;&nbsp;SAC: ' + e(sessionId) : '') + '</div>' +"
new_footer = "'<div class=\"footer\">Controlled Document&nbsp;&nbsp;|&nbsp;&nbsp;Internal Use</div>' +"
if old_footer in pg:
    pg = pg.replace(old_footer, new_footer, 1)
elif new_footer not in pg:
    raise SystemExit('PG-ADM-01 footer marker not found')

# Mark the generator as visually locked to the approved controlled reference.
marker = "const V2_PG_ADM01_IPGS_LOGO_ID = '1YACP9HsO94-m-mQ-tLPq4J3RbTqyA36r';"
locked = marker + "\nconst V2_PG_ADM01_CONTROLLED_REFERENCE_PDF_ID = '1oAVVfCzHdOesKfOSPX30M0xJxXXaIJQ4';"
if marker in pg and 'V2_PG_ADM01_CONTROLLED_REFERENCE_PDF_ID' not in pg:
    pg = pg.replace(marker, locked, 1)

pg_path.write_text(pg, encoding='utf-8')

print('Phase 2 document layout patch applied.')
