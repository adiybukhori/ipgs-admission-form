const fs=require('fs'),path=require('path'),vm=require('vm');
const root=__dirname, backup=path.join(root,'..','acc-v2-backup-20261016');
if(!fs.existsSync(backup)) fs.cpSync(root,backup,{recursive:true});
function edit(name,from,to){const p=path.join(root,name),s=fs.readFileSync(p,'utf8');
 if(s.includes(to))return; if(!s.includes(from))throw Error('Patch anchor mismatch: '+name);
 fs.writeFileSync(p,s.replace(from,to));}
edit('WorkflowV2.js',"function v2VerifyAdminApiAccess_(token, action) {",
 "function v2VerifyAdminApiAccess_(token, action) {\n  if (v2VerifyWorkflowServiceAccess_(token, action)) return true;");
edit('WorkflowV2.js',"v2VerifyAdminApiAccess_(params.token);","v2VerifyAdminApiAccess_(params.token, action);");
edit('WorkflowV2.js',"  if (action === 'v2ListWorkflow') return v2ListWorkflow_(payload);",
 "  if (action === 'v2WorkflowDiagnostics') return v2WorkflowDiagnostics_();\n  if (action === 'v2ListWorkflow') return v2ListWorkflow_(payload);");
const cp=path.join(root,'Code.js');let c=fs.readFileSync(cp,'utf8');
const start=c.indexOf("      const properties = PropertiesService.getScriptProperties();",c.indexOf('// DIRECT_SAC_PACK_FILE_FAST_PATH'));
const end=c.indexOf("      const directResult = v2GetSacPackFileDirect_",start);
if(start<0||end<0)throw Error('SAC gateway anchor mismatch');
c=c.slice(0,start)+"      v2VerifyAdminApiAccess_(payload.token, action);\n\n"+c.slice(end);fs.writeFileSync(cp,c);
edit('OrientationV2.js',"function v2CreateOrientationSession_(data, actor) {",
 "function v2CreateOrientationSession_(data, actor) {\n  const lock=LockService.getScriptLock();\n  lock.waitLock(30000);\n  try { return v2CreateOrientationSessionUnlocked_(data,actor); } finally { lock.releaseLock(); }\n}\n\nfunction v2CreateOrientationSessionUnlocked_(data, actor) {");
edit('OrientationV2.js',"  const createdAt = existing ? String(existing.record['Created At'] || now) : now;",
 "  if (existing) {\n    const r=existing.record;\n    if (String(r['Orientation Name'])!==name || String(r['Intake ID'])!==intakeId || String(r['Session Date']).slice(0,10)!==String(sessionDate).slice(0,10)) throw new Error('This session request was already saved. Open the existing session to edit it.');\n    return {ok:true,created:false,duplicateSuppressed:true,session:r,reminderAutomation:v2OrientationEnsureReminderTrigger_(),build:V2_ORIENTATION_BUILD};\n  }\n  const createdAt = existing ? String(existing.record['Created At'] || now) : now;");
const scripts=fs.readdirSync(root).filter(n=>n.endsWith('.js'));
new vm.Script(scripts.map(n=>fs.readFileSync(path.join(root,n),'utf8')).join('\n'));
console.log(JSON.stringify({patched:true,syntaxChecked:scripts.length,backup,files:['WorkflowV2.js','Code.js','OrientationV2.js','WorkflowServiceAuthV2.js']}));
