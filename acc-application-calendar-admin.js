(function(){
'use strict';
const el=id=>document.getElementById(id);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zone='Asia/Kuala_Lumpur';
let selectedDay='',month='',entries=[],ready=false,missingDates=0,lastRefreshed='';
function kualaDay(date){
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function parseSubmitted(value){
 if(value instanceof Date)return Number.isFinite(value.getTime())?value:null;
 if(typeof value==='number'){const date=new Date(value);return Number.isFinite(date.getTime())?date:null}
 const raw=String(value||'').trim();if(!raw)return null;
 // Google Sheet stores dd/MM/yyyy in Malaysian locale. Parse this ahead of Date.parse
 // to avoid silent US date inversion for days 1-12.
 let match=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
 if(match){const [,d,m,y,h='0',min='0',sec='0']=match;const date=new Date(Date.UTC(+y,+m-1,+d,+h-8,+min,+sec));return date.getUTCDate()>=1?date:null}
 match=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
 if(match){const [,y,m,d,h='0',min='0',sec='0']=match;return new Date(Date.UTC(+y,+m-1,+d,+h-8,+min,+sec))}
 const date=new Date(raw);return Number.isFinite(date.getTime())?date:null;
}
function toUiDate(day){if(!day)return 'Date unavailable';const [y,m,d]=day.split('-').map(Number);return new Intl.DateTimeFormat('en-MY',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d)))}
function fmtTime(date){return date?new Intl.DateTimeFormat('en-MY',{timeZone:zone,day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(date):'—'}
function field(r,key){return String(r?.app?.[key]||'').trim()}
function agentCategory(r){return String(r.appAdmin?.agent_name||r.app?.['Agent Name']||r.appAdmin?.sky_snapshot_category||r.app?.['Student Category']||'Unassigned').trim()}
function submissionKey(r){const id=field(r,'ID / Passport No').toUpperCase().replace(/[^A-Z0-9]/g,'');const email=field(r,'Personal Email').toLowerCase();return id?'ID:'+id:email?'EMAIL:'+email:'REF:'+String(r.ref||'')}
function getCurrentFilters(){return {programme:el('mkcProgramme')?.value||'',intake:el('mkcIntake')?.value||'',stage:el('mkcSource')?.value||''}}
function initSelect(id,values,label){const node=el(id);if(!node)return;const previous=node.value,items=[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));node.innerHTML='<option value="">'+escapeHtml(label)+'</option>'+items.map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join('');if(items.includes(previous))node.value=previous}
function collect(){
 const rows=typeof activeV2Records==='function'?activeV2Records():[];
 const seenRefs=new Set(),raw=[];
 missingDates=0;
 for(const r of rows){
   if(r.source!=='V2'||!r.app)continue;
   const ref=String(r.ref||'').trim();if(ref&&seenRefs.has(ref))continue;if(ref)seenRefs.add(ref);
   const date=parseSubmitted(r.app['Submitted At']);
   if(!date){missingDates++;continue}
   raw.push({r,date,day:kualaDay(date),key:submissionKey(r),stage:String(stage(r)||''),activation:accSkyStatus(r)==='ACTIVATED'});
 }
 // A person can appear on separate dates; within a day count the first
 // received application as one person while preserving repeat submission count.
 const groups=new Map();
 for(const row of raw.sort((x,y)=>x.date-y.date)){
   const key=row.day+'|'+row.key;
   if(!groups.has(key))groups.set(key,{...row,rows:[row],count:1});
   else {const group=groups.get(key);group.rows.push(row);group.count++;if(row.activation&&!group.activation)group.activation=true}
 }
 entries=[...groups.values()];
 initSelect('mkcProgramme',raw.map(x=>field(x.r,'Programme')),'All Programmes');
 initSelect('mkcIntake',raw.map(x=>field(x.r,'Intake')),'All Intakes');
 initSelect('mkcSource',raw.map(x=>x.stage),'All Application Stages');
 ready=true;
}
function matching(f){return entries.filter(x=>(!f.programme||x.rows.some(y=>field(y.r,'Programme')===f.programme))&&(!f.intake||x.rows.some(y=>field(y.r,'Intake')===f.intake))&&(!f.stage||x.rows.some(y=>y.stage===f.stage)))}
function render(){
 if(!el('mkcGrid'))return;
 if(typeof activeV2Records!=='function')return;
 collect();if(!selectedDay){selectedDay=kualaDay(new Date());month=selectedDay.slice(0,7)}
 const filtered=matching(getCurrentFilters()),[year,mon]=month.split('-').map(Number);
 const first=new Date(Date.UTC(year,mon-1,1)),days=new Date(Date.UTC(year,mon,0)).getUTCDate(),offset=(first.getUTCDay()+6)%7;
 el('mkcMonth').textContent=new Intl.DateTimeFormat('en-MY',{timeZone:'UTC',year:'numeric',month:'long'}).format(first);
 const counts=new Map();
 for(const group of filtered){
   const item=counts.get(group.day)||{total:0,activated:0};
   item.total++;
   if(group.activation)item.activated++;
   counts.set(group.day,item);
 }
 const cells=Array.from({length:offset},()=>'<span aria-hidden="true"></span>');
 for(let n=1;n<=days;n++){
   const day=month+'-'+String(n).padStart(2,'0');
   const summary=counts.get(day)||{total:0,activated:0};
   const count=summary.total,activated=summary.activated;
   const rate=count?Math.round(activated/count*100):0;
   const color=!count?'status-empty':activated===count?'status-complete':activated===0?'status-zero':'status-partial';
   const hint=count?(activated+' of '+count+' activated in ACC ('+rate+'%)'):'No ACC applications';
   cells.push('<button type="button" class="mkc-date '+color+' '+(day===selectedDay?'selected':'')+'" data-mkc-day="'+day+'" title="'+escapeHtml(hint)+'" aria-pressed="'+(day===selectedDay)+'" aria-label="'+day+': '+count+' unique ACC applicants; '+hint+'"><span>'+n+'</span>'+(count?'<strong>'+count+'</strong><small>applied</small>':'<small>—</small>')+'</button>');
 }
 el('mkcGrid').innerHTML=cells.join('');
 const currentMonth=filtered.filter(x=>x.day.startsWith(month));
 el('mkcMonthTotal').textContent=new Set(currentMonth.map(x=>x.key)).size+' unique applicants this month';
 const list=filtered.filter(x=>x.day===selectedDay).sort((a,b)=>a.date-b.date),activated=list.filter(x=>x.activation).length;
 const submitted=list.reduce((n,x)=>n+x.count,0);
 const repeated=submitted-list.length;
 el('mkcDate').textContent=toUiDate(selectedDay);
 el('mkcTotal').textContent=list.length;
 el('mkcSubmission').textContent=submitted+' ACC application'+(submitted===1?'':'s')+' · '+repeated+' duplicate'+(repeated===1?'':'s')+' on this date';
 el('mkcClosed').textContent=activated;
 el('mkcNotClosed').textContent=list.length-activated;
 el('mkcRate').textContent=(list.length?Math.round(activated/list.length*100):0)+'%';
 const programmeCounts={};list.forEach(x=>{const name=field(x.r,'Programme')||'Not specified';programmeCounts[name]=(programmeCounts[name]||0)+1});
 el('mkcProgrammes').innerHTML=Object.entries(programmeCounts).sort((a,b)=>b[1]-a[1]).map(([p,n])=>'<div class="mkc-programme"><span>'+escapeHtml(p)+'</span><strong>'+n+'</strong></div>').join('')||'<p class="mkc-small">No ACC applications submitted on the selected date.</p>';
 el('mkcCandidateCount').textContent=list.length+' applicants';
 el('mkcCandidateTitle').textContent='ACC applications submitted on '+toUiDate(selectedDay);
 el('mkcRows').innerHTML=list.map(x=>{
   const r=x.r,decisionLabel=String(decision(r)||'Pending'),state=x.activation?'Activated in ACC':'Not Activated';
   return '<tr><td><strong>'+escapeHtml(field(r,'Student Name')||'—')+'</strong><div class="mkc-small">'+escapeHtml(field(r,'Personal Email'))+'</div></td><td>'+escapeHtml(fmtTime(x.date))+(x.count>1?'<div class="mkc-small">'+x.count+' applications</div>':'')+'</td><td><strong>'+escapeHtml(field(r,'Programme'))+'</strong><div class="mkc-small">'+escapeHtml(field(r,'Intake'))+'</div></td><td>'+escapeHtml(x.stage.replaceAll('_',' '))+'<div class="mkc-small">'+escapeHtml(decisionLabel.replaceAll('_',' '))+'</div></td><td><span class="mkc-tag '+(x.activation?'ok':'')+'">'+escapeHtml(state)+'</span></td><td><button class="mkc-btn" type="button" data-mkc-acc="'+escapeHtml(r.ref)+'">Open record</button></td></tr>'
 }).join('')||'<tr><td class="mkc-empty" colspan="6">No ACC applications for this date and filters.</td></tr>';
 lastRefreshed=el('freshness')?.textContent||'ACC loaded';
 el('mkcStatus').textContent='Source: ACC V2 Applications · '+lastRefreshed+(missingDates?' · '+missingDates+' records excluded (no submission date)':'');
}
window.renderAccApplicationCalendar=render;
window.loadAccApplicationCalendar=async function(force=false){
 const button=el('mkcReload');
 if(force){
   if(button)button.disabled=true;
   el('mkcStatus').textContent='Refreshing ACC application records…';
   try{await loadData(true);render()}catch(e){el('mkcStatus').textContent='ACC refresh failed — review the main ACC refresh status';}
   finally{if(button)button.disabled=false}
 }else render();
};
window.mkRenderCalendar=render;
window.mkMoveMonth=function(step){if(!ready)render();const [y,m]=month.split('-').map(Number);month=new Date(Date.UTC(y,m-1+step,1)).toISOString().slice(0,7);const [ny,nm]=month.split('-').map(Number);const last=new Date(Date.UTC(ny,nm,0)).getUTCDate();const current=Number(selectedDay.slice(-2))||1;selectedDay=month+'-'+String(Math.min(current,last)).padStart(2,'0');render()};
window.mkCalendarToday=function(){selectedDay=kualaDay(new Date());month=selectedDay.slice(0,7);render()};
window.mkScrollCandidates=function(){el('mkcCandidates')?.scrollIntoView({behavior:'smooth',block:'start'})};
document.addEventListener('click',event=>{
 const date=event.target.closest('[data-mkc-day]');if(date){selectedDay=date.dataset.mkcDay;month=selectedDay.slice(0,7);render();return}
 const action=event.target.closest('[data-mkc-acc]');if(action&&typeof openRecord==='function')openRecord(action.dataset.mkcAcc);
});
})();
