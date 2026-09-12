$ErrorActionPreference = 'Stop'

$expectedBranch = 'apps-script-v2-dev'
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($currentBranch -ne $expectedBranch) {
  throw "SAFE STOP: expected branch '$expectedBranch' but found '$currentBranch'."
}

if (git status --porcelain) {
  throw 'SAFE STOP: local repository has uncommitted changes.'
}

git pull --ff-only origin $expectedBranch
if ($LASTEXITCODE -ne 0) { throw 'SAFE STOP: git pull failed.' }

node tools/verify-clasp-target.mjs
if ($LASTEXITCODE -ne 0) { throw 'SAFE STOP: clasp target verification failed.' }

Write-Host '--- clasp status BEFORE push ---'
npx -y @google/clasp@latest status
if ($LASTEXITCODE -ne 0) { throw 'SAFE STOP: clasp status failed.' }

Write-Host '--- pushing V2 source (NO --force) ---'
npx -y @google/clasp@latest push
if ($LASTEXITCODE -ne 0) { throw 'SAFE STOP: clasp push failed.' }

Write-Host '--- clasp status AFTER push ---'
npx -y @google/clasp@latest status
if ($LASTEXITCODE -ne 0) { throw 'SAFE STOP: post-push clasp status failed.' }

Write-Host 'V2_PUSH_OK: source synced. No deployment was created or updated.'
