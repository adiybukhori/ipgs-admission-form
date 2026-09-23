import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('n8n');
const expected=[
  'CS-ADM-V2-00-ORCHESTRATOR.json',
  'CS-ADM-V2-01-COMPLIANCE.json',
  'CS-ADM-V2-02-ADMISSION-INTELLIGENCE.json',
  'CS-ADM-V2-03-SAC-IA.json',
  'CS-ADM-V2-04-STUDENT-CONCIERGE.json',
  'CS-ADM-V2-05-SYSTEMS-OPERATOR.json',
  'CS-ADM-V2-06-ORIENTATION.json',
  'CS-ADM-V2-07-ACADEMIC-HANDOVER.json',
  'CS-ADM-V2-08-MANAGEMENT-INTELLIGENCE.json',
  'CS-ADM-V2-90-EVENT-INGRESS.json',
  'CS-ADM-V2-91-ACTION-GATEWAY.json',
  'CS-ADM-V2-92-HUMAN-TASK-GATEWAY.json',
  'CS-ADM-V2-93-ERROR-RETRY.json'
];

const actual=fs.readdirSync(root).filter(x=>/^CS-ADM-V2-.*\.json$/.test(x)).sort();
const missing=expected.filter(x=>!actual.includes(x));
const extra=actual.filter(x=>!expected.includes(x));
if(missing.length)throw new Error('Missing required n8n workflows: '+missing.join(', '));
if(extra.length)throw new Error('Unexpected CS-ADM-V2 workflow files: '+extra.join(', '));
if(actual.length!==expected.length)throw new Error('Expected '+expected.length+' workflows, found '+actual.length);

const webhookPaths=new Map();
const workflowNames=new Set();
const allowedSecret='REPLACE_WITH_N8N_EVENT_SHARED_SECRET';
const allowedAdmin='REPLACE_WITH_V2_ADMIN_API_PASSWORD';

for(const file of expected){
  const full=path.join(root,file);
  const raw=fs.readFileSync(full,'utf8');
  const data=JSON.parse(raw);

  if(!data.name?.startsWith('CS-ADM-V2 | '))throw new Error(file+': workflow name must use CS-ADM-V2 namespace');
  if(workflowNames.has(data.name))throw new Error(file+': duplicate workflow name '+data.name);
  workflowNames.add(data.name);

  if(data.active!==false)throw new Error(file+': import export must remain inactive until controlled activation');
  if(!Array.isArray(data.nodes)||!data.nodes.length)throw new Error(file+': nodes missing');

  const names=new Set();
  for(const node of data.nodes){
    if(!node.name)throw new Error(file+': node without a name');
    if(names.has(node.name))throw new Error(file+': duplicate node name '+node.name);
    names.add(node.name);

    if(node.type==='n8n-nodes-base.webhook'){
      const p=String(node.parameters?.path||'').trim();
      if(!p)throw new Error(file+': webhook '+node.name+' has no path');
      if(webhookPaths.has(p))throw new Error(file+': duplicate webhook path '+p+' also used by '+webhookPaths.get(p));
      webhookPaths.set(p,file);
    }
  }

  for(const [source,sets] of Object.entries(data.connections||{})){
    if(!names.has(source))throw new Error(file+': connection source does not exist: '+source);
    for(const branch of sets.main||[]){
      for(const edge of branch||[]){
        if(!names.has(edge.node))throw new Error(file+': connection target does not exist: '+edge.node);
      }
    }
  }

  if(/(?:AIza|sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{16,}|github_pat_)/.test(raw)){
    throw new Error(file+': possible live secret detected');
  }

  if(raw.includes('X-IUC-Agent-Secret')&&!raw.includes(allowedSecret)){
    throw new Error(file+': shared secret header exists without the approved placeholder');
  }

  if(raw.includes('V2_ADMIN_API_PASSWORD')&&!raw.includes(allowedAdmin)){
    throw new Error(file+': V2 admin password reference exists without the approved placeholder');
  }
}

const management=JSON.parse(fs.readFileSync(path.join(root,'CS-ADM-V2-08-MANAGEMENT-INTELLIGENCE.json'),'utf8'));
if(management.settings?.timezone!=='Asia/Kuala_Lumpur'){
  throw new Error('Management Intelligence workflow timezone must be Asia/Kuala_Lumpur');
}
const schedule=management.nodes.find(n=>n.type==='n8n-nodes-base.scheduleTrigger');
const scheduleText=JSON.stringify(schedule||{});
if(!schedule||!scheduleText.includes('30 8 * * *')){
  throw new Error('Management Intelligence workflow must contain the 08:30 daily schedule');
}

console.log('Agentic workflow set OK:',expected.length,'workflows');
console.log('Unique webhook paths:',webhookPaths.size);
