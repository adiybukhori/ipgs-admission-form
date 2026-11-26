/**
 * ACC authoritative Programme Coordinator Directory.
 * UAT seeds are for preview and the staged migration only.
 * NEVER use seeds as a fallback for LIVE LOA issuance.
 */
export const PROGRAMME_COORDINATOR_SEEDS=Object.freeze([
 {programme_code:'PGDT',programme_name:'Postgraduate Diploma in Teaching',level:'Postgraduate Diploma',coordinator_name:'Rushdina Arifah Rushdan',coordinator_email:'rushdina@innovative.edu.my',coordinator_role:'PGDT Programme Coordinator',is_active:true},
 {programme_code:'MBA',programme_name:'Master of Business Administration',level:'Master',coordinator_name:'Muhammad Naqiyuddin Bin Mohd Jihat',coordinator_email:'naqiyuddin.ipgs@innovative.edu.my',coordinator_role:'MBA Programme Coordinator',is_active:true},
 {programme_code:'MBM',programme_name:'Master in Business Management',level:'Master',coordinator_name:'Abuzar Bin Azizan',coordinator_email:'abuzar@innovative.edu.my',coordinator_role:'MBM Programme Coordinator',is_active:true},
 {programme_code:'MHUM',programme_name:'Master in Hajj & Umrah Management',level:'Master',coordinator_name:'Muhammad Naqiyuddin Bin Mohd Jihat',coordinator_email:'naqiyuddin.ipgs@innovative.edu.my',coordinator_role:'MHUM Programme Coordinator',is_active:true},
 {programme_code:'MIS',programme_name:'Master in Islamic Studies',level:'Master',coordinator_name:'Aminah Binti Abdullah',coordinator_email:'aminah.abdullah@innovative.edu.my',coordinator_role:'MIS Programme Coordinator',is_active:true},
 {programme_code:'PHD',programme_name:'Doctor of Philosophy in Management',level:'Doctorate',coordinator_name:'Noorus Sarah',coordinator_email:'noorus.sarah@innovative.edu.my',coordinator_role:'PhD Programme Coordinator',is_active:true},
 {programme_code:'DBA',programme_name:'Doctorate of Business Administration',level:'Doctorate',coordinator_name:'Noorus Sarah',coordinator_email:'noorus.sarah@innovative.edu.my',coordinator_role:'DBA Programme Coordinator',is_active:true},
 {programme_code:'MEDU',programme_name:'Master in Education',level:'Master',coordinator_name:'Muhammad Abu Huzaifah Bin Zulkifli',coordinator_email:'abu.huzaifah.ipgs@innovative.edu.my',coordinator_role:'MEDU Programme Coordinator',is_active:true},
 {programme_code:'BBA',programme_name:'Bachelor in Business Administration',level:'Bachelor',coordinator_name:'Muhammad Naqiyuddin Bin Mohd Jihat',coordinator_email:'naqiyuddin.ipgs@innovative.edu.my',coordinator_role:'BBA Programme Coordinator',is_active:true}
]);

export function accProgrammeCode(programme){
 const raw=String(programme||'').trim();
 const code=(raw.match(/^(PGDT|DPLI|MBA|MBM|MHUM|MIS|PHD|DBA|MEDU|BBA)\b/i)||[])[1]?.toUpperCase();
 return code==='DPLI'?'PGDT':code||'';
}
export function accValidateDirectoryRow(value,{allowIncomplete=false}={}){
 const r=value||{},code=String(r.programme_code||'').trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9]{1,14}$/.test(code)||code==='DPLI'||code==='DBAODL')
   throw Error('Valid programme code required. DPLI is a PGDT alias; DBA ODL is excluded.');
 const name=String(r.programme_name||'').trim();
 if(name.length<4||name.length>180)throw Error('Approved programme name is required.');
 const level=String(r.level||'').trim();
 if(!['Postgraduate Diploma','Bachelor','Master','Doctorate'].includes(level))
   throw Error('Select a valid level of study.');
 const person=String(r.coordinator_name||'').trim(),email=String(r.coordinator_email||'').trim().toLowerCase(),
       role=String(r.coordinator_role||'').trim(),isActive=r.is_active===true;
 const complete=person.length>=3&&person.length<=180&&
    /^[a-z0-9._%+-]+@innovative\.edu\.my$/.test(email)&&role.length>=4&&role.length<=160;
 if(isActive&&!complete)throw Error('Cannot activate this programme without coordinator full name, official email and role.');
 if(!allowIncomplete&&!complete)throw Error('Programme coordinator details are incomplete.');
 if(person.length>180||email.length>240||role.length>160)throw Error('Coordinator details exceed permitted length.');
 return {programme_code:code,programme_name:name,level,coordinator_name:person,
   coordinator_email:email,coordinator_role:role,is_active:isActive};
}
export function accResolveCoordinator(programme,rows){
 const code=accProgrammeCode(programme);
 const match=Array.isArray(rows)?rows.find(x=>String(x?.programme_code||'').toUpperCase()===code):null;
 if(!code||!match)throw Error('LOA blocked: programme '+(code||'UNKNOWN')+' has no configured coordinator in ACC Settings.');
 const row=accValidateDirectoryRow(match);
 if(!row.is_active)throw Error('LOA blocked: programme '+code+' is inactive in the Coordinator Directory.');
 return Object.freeze({code,name:row.coordinator_name,email:row.coordinator_email,
   role:row.coordinator_role,programmeName:row.programme_name});
}
