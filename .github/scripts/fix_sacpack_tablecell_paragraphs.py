from pathlib import Path

path = Path('apps-script-v2/SacPackV2.js')
text = path.read_text(encoding='utf-8')

marker = 'function v2SacPackStyleInfoTable_(table) {'
helper = '''function v2SacPackForEachParagraph_(cell, callback) {\n  for (let i = 0; i < cell.getNumChildren(); i++) {\n    const child = cell.getChild(i);\n    const type = child.getType();\n    if (type === DocumentApp.ElementType.PARAGRAPH) {\n      callback(child.asParagraph());\n    } else if (type === DocumentApp.ElementType.LIST_ITEM) {\n      callback(child.asListItem());\n    }\n  }\n}\n\n'''

if helper not in text:
    if marker not in text:
        raise SystemExit('Style marker not found')
    text = text.replace(marker, helper + marker, 1)

old = 'cell.getParagraphs().forEach(function(p) {'
count = text.count(old)
if count:
    text = text.replace(old, 'v2SacPackForEachParagraph_(cell, function(p) {')

old_sig = '''      const paragraphs = cell.getParagraphs();\n      paragraphs.forEach(function(p) {'''
if old_sig in text:
    text = text.replace(old_sig, '''      v2SacPackForEachParagraph_(cell, function(p) {''', 1)

if 'cell.getParagraphs()' in text:
    raise SystemExit('Unsupported TableCell.getParagraphs() remains in SacPackV2.js')

path.write_text(text, encoding='utf-8')
print('Patched SacPackV2.js TableCell paragraph traversal')
