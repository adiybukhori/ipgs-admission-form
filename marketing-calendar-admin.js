(function(){
'use strict';
const $=id=>document.getElementById(id);
const a=window.MarketingAnalytics;
let data=[],loaded=false,busy=false,selectedDay='',calendarMonth='',summaryAt='';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isClosed=c=>c.activated===true&&c.snapshotCategory==='Internal';
const today=()=>a.localDate(new Date().toISOString());
function currentFilters(){return {programme:$('mkcProgramme')?.value||'',intake:$('mkcIntake')?.value||'',source:$('mkcSource')?.value||''};}
function options(id,items,label){
 const node=$(id);if(!node)return;const current=node.value;
 const distinct=[...new Set(items.filter(Boolean))].sort((x,y)=>x.localeCompare(y));
 node.innerHTML='<option value="">'+esc(label)+'</option>'+distinct.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 if(distinct.includes(current))node.value=current;
}
function render(){
 if(!loaded||!a)return;
 options('mkcProgramme',data.map(c=>c.programme),'All Programmes');
 options('mkcIntake',data.map(c=>c.intake),'All Intakes');
 options('mkcSource',data.flatMap(c=>a.events(c).map(e=>e.sourceTab)),'All Sources');
 const f=currentFilters(),all=a.days(data,f),[y,m]=calendarMonth.split('-').map(Number);
 const first=new Date(Date.UTC(y,m-1,1)),length=new Date(Date.UTC(y,m,0)).getUTCDate();
 const offset=(first.getUTCDay()+6)%7;
 $('mkcMonth').textContent=new Intl.DateTimeFormat('en-MY',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
 const grid=Array.from({length:offset},()=>'<span aria-hidden="true"></span>');
 for(let n=1;n<=length;n++){
   const day=calendarMonth+'-'+String(n).padStart(2,'0'),count=all[day]?.unique||0;
   grid.push('<button type="button" class="mkc-date '+(count?'has-data ':'')+(day===selectedDay?'selected':'')+'" data-mkc-day="'+day+'" aria-pressed="'+(day===selectedDay)+'" aria-label="'+day+': '+count+' unique registrations"><span>'+n+'</span>'+(count?'<strong>'+count+'</strong><small>registered</small>':'<small>—</small>')+'</button>');
 }
 $('mkcGrid').innerHTML=grid.join('');
 const monthly=a.filterCandidates(data,{...f,from:calendarMonth+'-01',to:calendarMonth+'-'+String(length).padStart(2,'0')});
 $('mkcMonthTotal').textContent=monthly.length+' unique students this month';
 const selectedFilter={...f,from:selectedDay,to:selectedDay},people=a.filterCandidates(data,selectedFilter),stats=a.stats(people,selectedFilter);
 const closed=people.filter(isClosed).length,dup=stats.submissions-stats.unique;
 $('mkcDate').textContent=a.formatDate(selectedDay+'T12:00:00+08:00',false);
 $('mkcTotal').textContent=stats.unique;
 $('mkcSubmission').textContent=stats.submissions+' form submission'+(stats.submissions===1?'':'s')+' · '+dup+' repeat submission'+(dup===1?'':'s');
 $('mkcClosed').textContent=closed;
 $('mkcNotClosed').textContent=stats.unique-closed;
 $('mkcRate').textContent=(stats.unique?Math.round(closed/stats.unique*100):0)+'%';
 const progs={};for(const p of people){progs[p.programme||'Not specified']=(progs[p.programme||'Not specified']||0)+1}
 $('mkcProgrammes').innerHTML=Object.entries(progs).sort((x,y)=>y[1]-x[1]).map(([p,n])=>'<div class="mkc-programme"><span>'+esc(p)+'</span><b>'+n+'</b></div>').join('')||'<p class="mkc-small">No registrations on this date.</p>';
 $('mkcCandidateCount').textContent=stats.unique+' candidates';
 $('mkcCandidateTitle').textContent='Candidates registered on '+a.formatDate(selectedDay+'T12:00:00+08:00',false);
 $('mkcRows').innerHTML=people.map(p=>{
   const events=a.matchingEvents(p,selectedFilter),time=events.length?a.formatDate(events[0].registeredAt):'—';
   const action=p.accFound?'<button class="mkc-btn" type="button" data-mkc-acc="'+esc(p.ic)+'">Open in ACC</button>':'<span class="mkc-small">Marketing only</span>';
   return '<tr><td><strong>'+esc(p.name)+'</strong><div class="mkc-small">'+esc(p.email)+'</div></td><td>'+esc(time)+'</td><td><strong>'+esc(p.programme)+'</strong><div class="mkc-small">'+esc(p.intake)+'</div></td><td><span class="mkc-tag '+(p.accFound?'acc':'')+'">'+(p.accFound?'In ACC':'Not in ACC')+'</span></td><td><span class="mkc-tag '+(isClosed(p)?'ok':'')+'">'+(isClosed(p)?'Closed · Internal IPGS':p.activated?'Active · Other Category':'Not Yet Closed')+'</span></td><td>'+action+'</td></tr>';
 }).join('')||'<tr><td colspan="6" class="mkc-empty">No marketing registrations found for this date.</td></tr>';
 $('mkcStatus').textContent='Source: Marketing Portal · Last refreshed '+(summaryAt?a.formatDate(summaryAt):'just now');
}
window.mkRenderCalendar=render;
function setDay(day){if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day))return;selectedDay=day;calendarMonth=day.slice(0,7);render()}
window.mkMoveMonth=function(step){if(!loaded)return;const [y,m]=calendarMonth.split('-').map(Number);calendarMonth=new Date(Date.UTC(y,m-1+step,1)).toISOString().slice(0,7);render()};
window.mkCalendarToday=function(){if(!loaded)return;setDay(today())};
window.mkScrollCandidates=function(){$('mkcCandidates')?.scrollIntoView({behavior:'smooth',block:'start'})};
window.loadMarketingCalendar=async function(force=false){
 if(!a){$('mkcStatus').textContent='Calendar analytics file missing.';return}
 if(busy)return;if(loaded&&!force){render();return}
 busy=true;$('mkcStatus').textContent='Syncing with Marketing Portal…';$('mkcError').hidden=true;$('mkcReload').disabled=true;
 try{
   const res=await fetch('/api/marketing-calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,sessionId:adminSessionId}),cache:'no-store'});
   const out=await res.json();
   if(!res.ok||!out.ok||!Array.isArray(out.candidates))throw new Error(out.message||'Calendar data unavailable');
   data=out.candidates;loaded=true;summaryAt=out.refreshedAt||new Date().toISOString();
   if(!selectedDay){const dates=Object.keys(a.days(data)).sort();selectedDay=dates.at(-1)||today();calendarMonth=selectedDay.slice(0,7)}
   render();
 }catch(e){$('mkcError').hidden=false;$('mkcError').textContent=e.message||'Marketing calendar could not be loaded.';$('mkcStatus').textContent='Sync failed — existing data retained';}
 finally{busy=false;$('mkcReload').disabled=false}
};
document.addEventListener('click',event=>{
 const day=event.target.closest('[data-mkc-day]');if(day){setDay(day.dataset.mkcDay);return}
 const btn=event.target.closest('[data-mkc-acc]');if(!btn)return;
 const tab=document.querySelector('.nav button[data-section="applications"]');
 if(typeof go==='function')go('applications',tab);
 const search=$('searchInput');if(search){search.value=btn.dataset.mkcAcc;if(typeof renderApplications==='function')renderApplications()}
});
})();
