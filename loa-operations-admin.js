/* ACC LOA Issuance Centre - shadow-mode UI, V2 data only.
   No legacy-sheet writes, imports, scheduled sends or status mutations occur here. */
(function(){
  'use strict';
  function loaKind(r) {
    const info=accOfferInfo(r);
    return info.issued ? 'ISSUED' : stage(r)==='ELIGIBLE_FOR_OFFER' ? 'READY' : 'WAITING';
  }
  // Only the authorised production ACC host may offer document issuance.
  // Preview is read-only even when its data happens to be available.
  function canIssueInThisEnvironment(){
    return location.hostname==='ipgs-admission-form.innovative.edu.my' &&
      db.ACC_APPLICATION_ADMIN_STATUS==='READY' && PHASE2_BACKEND_READY;
  }
  function isAccepted(r) {
    return String(r.workflow?.['Acceptance Status']||'').toUpperCase()==='ACCEPTED';
  }
  function label(value){ return esc(pretty(value||'-')); }
  function count(id,value){ const el=document.getElementById(id); if(el)el.textContent=String(value); }
  window.renderLoaOperations=function renderLoaOperations(){
    const body=document.getElementById('loaCentreBody'); if(!body||!Array.isArray(records))return;
    const all=activeV2Records();
    count('loaTotalKpi',all.length);
    count('loaReadyKpi',all.filter(r=>loaKind(r)==='READY').length);
    count('loaIssuedKpi',all.filter(r=>loaKind(r)==='ISSUED').length);
    count('loaPendingKpi',all.filter(r=>loaKind(r)==='ISSUED'&&!isAccepted(r)).length);
    const q=String(document.getElementById('loaCentreSearch')?.value||'').toLowerCase().trim();
    const filter=String(document.getElementById('loaCentreStatus')?.value||'').toUpperCase();
    const list=all.filter(r=>{
      const kind=loaKind(r);
      const text=[r.ref,r.app?.['Student Name'],r.app?.['Programme'],r.app?.['Intake']].join(' ').toLowerCase();
      return (!q||text.includes(q))&&(!filter||kind===filter);
    }).slice(0,250);
    body.innerHTML=list.map(r=>{
      const kind=loaKind(r),info=accOfferInfo(r),name=r.app?.['Student Name']||'-',programme=r.app?.['Programme']||'-';
      const dataRef=' data-ref="'+esc(r.ref)+'"';
      const action=kind==='READY'&&canIssueInThisEnvironment()
        ? '<button class="primary" type="button"'+dataRef+' onclick="loaIssueFromRow(this)">Generate &amp; Send LOA</button>'
        : canIssueInThisEnvironment()
          ? '<button class="ghost" type="button"'+dataRef+' onclick="loaOpenRecord(this)">View Application</button>'
          : '<button class="ghost" type="button" disabled title="Preview is read-only; open the authorised production ACC for actions">Read-only preview</button>';
      const pdf=info.url?'<a class="ghost" target="_blank" rel="noopener" href="'+esc(info.url)+'">Open LOA</a>':'';
      const acceptance=String(r.workflow?.['Acceptance Status']||'NOT_OPEN').toUpperCase();
      const badge=kind==='ISSUED'?'green':kind==='READY'?'amber':'blue';
      return '<tr><td><div class="student">'+esc(name)+'</div><div class="subline">'+esc(r.ref)+'</div></td>'+
        '<td>'+esc(programme)+'<div class="subline">'+esc(r.app?.['Intake']||'-')+'</div></td>'+
        '<td>'+label(stage(r))+'<div class="subline">'+label(r.workflow?.['SAC Decision']||r.workflow?.['Screening Recommendation']||'')+'</div></td>'+
        '<td><span class="badge '+badge+'">'+label(kind)+'</span><div class="subline">'+esc(info.date?formatDate(info.date):'-')+'</div></td>'+
        '<td>'+label(acceptance)+'</td><td><div style="display:flex;flex-wrap:wrap;gap:6px">'+action+pdf+'</div></td></tr>';
    }).join('')||'<tr><td colspan="6"><div class="empty">No matching ACC applications.</div></td></tr>';
    const shown=document.getElementById('loaCentreShown');
    if(shown)shown.textContent=String(list.length)+(list.length===250?' (first 250)':'')+' matching ACC records';
  };
  window.loaOpenRecord=function loaOpenRecord(button){
    if(!canIssueInThisEnvironment()){alert('Preview is read-only. Use the authorised production ACC to edit this student.');return;}
    const ref=String(button?.dataset?.ref||'');if(ref)openRecord(ref);
  };
  window.loaIssueFromRow=function loaIssueFromRow(button){
    const ref=String(button?.dataset?.ref||''),r=records.find(x=>x.ref===ref);
    if(!r||loaKind(r)!=='READY'||!canIssueInThisEnvironment()){
      alert('This applicant is not currently eligible for official LOA issuance. Refresh ACC and review the admission gates.');return;
    }
    openRecord(ref);
    // Use the existing single issuer path with its explicit email confirmation and deduplication.
    issueOffer();
  };
})();