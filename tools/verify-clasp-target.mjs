import fs from 'node:fs';

const EXPECTED_SCRIPT_ID = '1MhvRLN2s336ndaFwLzQpGNSMEgafXxj_I5NIS8D9ZzyG3NGujHwXdih3';
const EXPECTED_ROOT_DIR = 'apps-script-v2';

const config = JSON.parse(fs.readFileSync('.clasp.json', 'utf8'));

if (config.scriptId !== EXPECTED_SCRIPT_ID) {
  throw new Error(`CLASP TARGET BLOCKED: expected ${EXPECTED_SCRIPT_ID}, got ${config.scriptId || '(missing)'}`);
}

if (String(config.rootDir || '').replace(/^\.\//, '') !== EXPECTED_ROOT_DIR) {
  throw new Error(`CLASP ROOT BLOCKED: expected ${EXPECTED_ROOT_DIR}, got ${config.rootDir || '(missing)'}`);
}

console.log('CLASP_SAFE_TARGET_OK');
console.log(`scriptId=${config.scriptId}`);
console.log(`rootDir=${config.rootDir}`);
