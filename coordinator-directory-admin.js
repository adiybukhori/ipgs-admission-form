/* ACC Programme Coordinator Directory — staff maintenance. Preview READ ONLY. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rows(){return Array.isArray(db.ACC_PROGRAMME_COORDINATORS)?db.ACC_PROGRAMME_COORDINATORS:[]}
function editable(){return db.ACC_PROGRAMME_COORDINATORS_STATUS==='READY' && !accLoaPreviewMode()}
function refresh(){
 const tbody=$('coordinatorDirectoryRows');if(!tbody)return;
 const list=rows(),ready=list.filter(r=>r.is_active===true&&r.coordinator_name&&r.coordinator_email&&r.coordinator_role);
 const badge=$('coordinatorDirectoryStatus'),msg=$('coordinatorDirectoryMessage');
 if(badge)badge.textContent=editable()?'LIVE DIRECTORY · STAFF EDITABLE':(db.ACC_PROGRAMME_COORDINATORS_STATUS==='PREVIEW_ONLY'?'UAT DATA · READ ONLY':'DIRECTORY UNAVAILABLE · LOA BLOCKED');
 if(msg){msg.textContent=editable()?
  'Changes saved here will be checked by the LOA backend before documents or email can be issued.':
  'Read-only UAT or directory unavailable. No coordinator changes or LOA issuance can be made from this preview.';}
 const create=$('coordinatorDirectoryAdd');if(create)create.disabled=!editable();
 const count=$('coordinatorDirectoryCounts');if(count)count.textContent=list.length+' Programmes · '+ready.length+' Coordinator Ready · '+(list.length-ready.length)+' Incomplete / Inactive';
 tbody.innerHTML=list.length?list.map(r=>{
  const code=String(r.programme_code||'').toUpperCase();
  const active=r.is_active===true,complete=active&&r.coordinator_name&&r.coordinator_email&&r.coordinator_role;
  return '<tr><td><strong>'+html(code)+'</strong><div class="subline">'+html(r.level||'')+'</div></td>'+
   '<td><div class="student">'+html(r.programme_name||'')+'</div></td>'+
   '<td><div class="student">'+html(r.coordinator_name||'Not assigned')+'</div><div class="subline">'+html(r.coordinator_email||'')+'</div><div class="subline">'+html(r.coordinator_role||'')+'</div></td>'+
   '<td><span class="badge '+(complete?'green':'amber')+'">'+(complete?'READY':(active?'INCOMPLETE':'INACTIVE'))+'</span></td>'+
   '<td><button type="button" class="ghost" '+(!editable()?'disabled':'')+' onclick="openCoordinatorEditor('+JSON.stringify(code).replace(/"/g,'&quot;')+')">Edit</button></td></tr>'
 }).join(''):'<tr><td colspan="5">No programme coordinator records. LIVE LOA issuance is blocked until the directory is configured.</td></tr>';
}
window.renderCoordinatorDirectory=refresh;
window.openCoordinatorEditor=function(code=''){
 if(!editable())return;
 const row=rows().find(r=>String(r.programme_code||'')===String(code))||{};
 const existing=!!row.programme_code,panel=$('coordinatorDirectoryEditor');
 if(!panel)return;
 panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'nearest'});
 $('coordinatorDirectoryEditorTitle').textContent=existing?'Update '+code:'Add Programme & Coordinator';
 $('coordinatorDirectoryCode').value=String(row.programme_code||'');
 $('coordinatorDirectoryCode').readOnly=existing;
 $('coordinatorDirectoryName').value=String(row.programme_name||'');
 $('coordinatorDirectoryLevel').value=String(row.level||'Master');
 $('coordinatorDirectoryPerson').value=String(row.coordinator_name||'');
 $('coordinatorDirectoryEmail').value=String(row.coordinator_email||'');
 $('coordinatorDirectoryRole').value=String(row.coordinator_role||'');
 $('coordinatorDirectoryActive').checked=row.is_active===true;
 $('coordinatorDirectoryEditorMessage').textContent='Active programmes require full PIC name, official innovative.edu.my email, and role. Inactive programmes cannot issue LOA.';
};
window.closeCoordinatorEditor=function(){const el=$('coordinatorDirectoryEditor');if(el)el.hidden=true};
window.saveCoordinatorDirectory=async function(){
 const feedback=$('coordinatorDirectoryEditorMessage');
 if(!editable()){if(feedback)feedback.textContent='Read-only: directory changes are disabled.';return;}
 const data={
  programme_code:$('coordinatorDirectoryCode').value.trim().toUpperCase(),
  programme_name:$('coordinatorDirectoryName').value.trim(),
  level:$('coordinatorDirectoryLevel').value,
  coordinator_name:$('coordinatorDirectoryPerson').value.trim(),
  coordinator_email:$('coordinatorDirectoryEmail').value.trim().toLowerCase(),
  coordinator_role:$('coordinatorDirectoryRole').value.trim(),
  is_active:$('coordinatorDirectoryActive').checked
 };
 if(!/^[A-Z][A-Z0-9]{1,14}$/.test(data.programme_code)||['DPLI','DBAODL'].includes(data.programme_code)){feedback.textContent='Enter a valid programme code. DPLI is a PGDT alias; DBA ODL excluded.';return;}
 if(!data.programme_name||!data.level){feedback.textContent='Programme name and level are mandatory.';return;}
 if(data.is_active&&(!data.coordinator_name||!data.coordinator_role||!(/^[a-z0-9._%+-]+@innovative\.edu\.my$/.test(data.coordinator_email)))){
   feedback.textContent='LOA BLOCKED: Complete coordinator name, official email, and role before activating this programme.';return;
 }
 const btn=$('coordinatorDirectorySave');btn.disabled=true;feedback.textContent='Saving coordinator…';
 try {
  const res=await fetch('/api/admin-action',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({password,action:'accUpsertProgrammeCoordinator',data,updatedBy:'ACC Registry'})});
  const parsed=await res.json().catch(()=>({ok:false,message:'Server returned invalid response'}));
  if(!res.ok||parsed.ok!==true)throw Error(parsed.message||'Save rejected by ACC backend.');
  closeCoordinatorEditor();
  await loadData(true);
  refresh();
 }catch(error){feedback.textContent='Not saved: '+String(error.message||'Unknown error');}
 finally{btn.disabled=false;}
};
})();