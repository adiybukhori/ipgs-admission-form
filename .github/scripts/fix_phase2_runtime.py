from pathlib import Path
p=Path('apps-script-v2/OfferLetterV2.js')
s=p.read_text(encoding='utf-8')
if 'function v2OfferHtmlEscape_' not in s:
    s=s.replace('v2Html_(', 'v2OfferHtmlEscape_(')
    s=s.rstrip()+'''\n\nfunction v2OfferHtmlEscape_(value) {\n  return String(value == null ? '' : value)\n    .replace(/&/g, '&amp;')\n    .replace(/</g, '&lt;')\n    .replace(/>/g, '&gt;')\n    .replace(/\"/g, '&quot;')\n    .replace(/'/g, '&#39;');\n}\n'''
p.write_text(s,encoding='utf-8')
