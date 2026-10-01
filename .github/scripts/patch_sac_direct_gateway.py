from pathlib import Path

p = Path('apps-script-v2/Code.js')
text = p.read_text(encoding='utf-8')

marker = "const action = String(payload && payload.action ? payload.action : '');"
if marker not in text:
    raise SystemExit('doPost action marker not found')

if 'DIRECT_SAC_PACK_FILE_FAST_PATH' in text:
    print('Direct SAC pack fast-path already present.')
    raise SystemExit(0)

insert = r'''

    // DIRECT_SAC_PACK_FILE_FAST_PATH
    // SAC print-pack retrieval is read-only and must bypass legacy DEV-locked helpers.
    if (action === 'v2GetSacPackFile' && payload.token) {
      const properties = PropertiesService.getScriptProperties();
      const expected = String(
        properties.getProperty('V2_ADMIN_API_PASSWORD') ||
        CONFIG.adminApiPassword ||
        ''
      ).trim();
      const received = String(payload.token || '').trim();

      if (!expected) {
        throw new Error('V2 admin password is not configured in Script Properties.');
      }
      if (!received || received !== expected) {
        throw new Error('Invalid V2 admin password.');
      }

      const directResult = v2GetSacPackFileDirect_(payload.data || {});
      return ContentService
        .createTextOutput(JSON.stringify(directResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
'''

text = text.replace(marker, marker + insert, 1)
p.write_text(text, encoding='utf-8')
print('Patched Code.js with DIRECT_SAC_PACK_FILE_FAST_PATH.')
