(function feeStructureAdminFile(){
  function feeMsg(text,type='info'){
    const el=document.getElementById('feeStructureMessage');if(!el)return;
    el.style.display='block';
    el.className='message '+(type==='error'?'error':'');
    el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';
    el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';
    el.textContent=text;
  }

  async function feeAction(action,data,confirmText){
    if(confirmText&&!confirm(confirmText))return null;
    feeMsg('Processing…');
    try{
      const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        password,action,data:data||{},updatedBy:'Admin Portal V2'
      })});
      const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
      if(!res.ok||!out.ok)throw new Error(out.message||'Unable to complete Fee Structure action.');
      await loadData(true);
      return out.result||out;
    }catch(e){
      feeMsg(e.message||'Unable to complete Fee Structure action.','error');
      return null;
    }
  }

  function rows(){
    return (db.FEE_GROUP_MASTER||[]).filter(r=>String(r['Fee Group Code']||'').trim());
  }
  function num(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0}
  function money(v){return 'RM '+num(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}
  function active(row){
    const x=String(row['Active']||'ACTIVE').trim().toUpperCase();
    return !x||['ACTIVE','YES','TRUE','1'].includes(x);
  }
  function schedule(row){
    try{const x=JSON.parse(String(row['Payment Schedule JSON']||'[]'));return Array.isArray(x)?x:[];}catch(_){return[]}
  }
  const FEE_COMPONENT_TYPES=[
    ['COURSEWORK_FEE','Coursework Fee'],
    ['RESEARCH_FEE','Research Fee'],
    ['MIXED_MODE_FEE','Mixed-Mode Fee'],
    ['REGISTRATION_FEE','Registration Fee'],
    ['NON_ACADEMIC_FEE','Other Approved Non-Academic Fee']
  ];
  const STUDY_MODES=['ALL','Full-Time','Part-Time','ODL','Online','Hybrid'];
  const LEVELS=['ALL','Diploma','Bachelor','Master','Doctorate'];
  const PAYMENT_LABELS=['Full Payment','Registration Fee','Instalment 1','Instalment 2','Instalment 3','Instalment 4','Instalment 5','Instalment 6','Instalment 7','Instalment 8','Instalment 9','Instalment 10','Instalment 11','Instalment 12','Convocation Fee','Viva Fee','Other'];
  const PAYMENT_DUE=['Upon Registration','Before Enrolment','Month 1','Month 2','Month 3','Month 4','Month 5','Month 6','Month 7','Month 8','Month 9','Month 10','Month 11','Month 12','Before Examination','Before Viva','Before Graduation','Other'];

  function components(row){
    try{
      const parsed=JSON.parse(String(row&&row['Fee Components JSON']||'[]'));
      if(Array.isArray(parsed)&&parsed.length)return parsed;
    }catch(_){}
    const legacy=[];
    const tuition=num(row&&row['Tuition Fee']);
    const registration=num(row&&row['Registration Fee']);
    const other=num(row&&row['Other Fee']);
    if(tuition) legacy.push({type:'ACADEMIC_FEE',amount:tuition,description:'Legacy academic fee — select Coursework, Research or Mixed-Mode when editing.'});
    if(registration) legacy.push({type:'REGISTRATION_FEE',amount:registration,description:''});
    if(other) legacy.push({type:'NON_ACADEMIC_FEE',amount:other,description:String(row&&row['Other Fee Description']||'Other approved charge')});
    return legacy;
  }
  function componentLabel(type){
    if(type==='ACADEMIC_FEE')return 'Academic Fee (Legacy / Unclassified)';
    return (FEE_COMPONENT_TYPES.find(x=>x[0]===type)||[type,pretty(type)])[1];
  }
  function uniqueSorted(values){
    return [...new Set(values.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  }
  function programmeOptions(){
    return ['ALL',...uniqueSorted([
      ...(db.V2_APPLICATIONS||[]).map(x=>x['Programme']),
      ...rows().map(x=>x['Programme']).filter(x=>String(x||'').toUpperCase()!=='ALL')
    ])];
  }
  function intakeOptions(){
    return ['ALL',...uniqueSorted([
      ...(db.V2_INTAKE_MASTER||[]).flatMap(x=>[x['Intake ID'],x['Intake Name']]),
      ...(db.V2_APPLICATIONS||[]).flatMap(x=>[x['Intake ID'],x['Intake']]),
      ...rows().map(x=>x['Intake Scope']).filter(x=>String(x||'').toUpperCase()!=='ALL')
    ])];
  }
  function optionsHtml(values,current){
    const cur=String(current||'');
    const list=values.slice();
    if(cur&&list.indexOf(cur)<0)list.unshift(cur);
    return list.map(v=>'<option value="'+esc(v)+'" '+(String(v)===cur?'selected':'')+'>'+esc(v)+'</option>').join('');
  }
  function componentOptionsHtml(current){
    const values=FEE_COMPONENT_TYPES.slice();
    if(current==='ACADEMIC_FEE')values.unshift(['ACADEMIC_FEE','Academic Fee (Legacy / Unclassified)']);
    return values.map(x=>'<option value="'+esc(x[0])+'" '+(x[0]===current?'selected':'')+'>'+esc(x[1])+'</option>').join('');
  }
  function fileUrlFromId(id){
    const x=String(id||'').trim();
    return x?'https://drive.google.com/open?id='+encodeURIComponent(x):'';
  }
  function optionLabel(row){
    const parts=[row['Fee Group Code'],row['Fee Structure Name'],num(row['Total Fee'])?money(row['Total Fee']).replace('RM ','RM'):''].filter(Boolean);
    return parts.join(' · ');
  }

  function closeFeeModal(){document.getElementById('feeStructureModal')?.remove()}
  function feeComponentRowHtml(item,index){
    item=item||{};
    const type=String(item.type||'COURSEWORK_FEE').toUpperCase();
    return `<div class="fee-component-row" data-index="${index}" style="display:grid;grid-template-columns:1.4fr .8fr 1.4fr auto;gap:8px;align-items:end;margin-bottom:8px">
      <div class="field"><label>Fee Component</label><select data-component-field="type">${componentOptionsHtml(type)}</select></div>
      <div class="field"><label>Amount (RM)</label><input data-component-field="amount" type="number" min="0" step="0.01" value="${item.amount!==undefined?esc(item.amount):''}" /></div>
      <div class="field"><label>Description</label><input data-component-field="description" value="${esc(item.description||'')}" placeholder="${type==='NON_ACADEMIC_FEE'?'Required for other non-academic fee':'Optional'}" /></div>
      <button type="button" class="ghost" onclick="removeFeeComponentRow(this)">Remove</button>
    </div>`;
  }
  window.removeFeeComponentRow=function(btn){btn.closest('.fee-component-row')?.remove();recalcFeeComponentTotal()};
  window.addFeeComponentRow=function(item){
    const box=document.getElementById('feeComponentRows');if(!box)return;
    const index=box.querySelectorAll('.fee-component-row').length;
    box.insertAdjacentHTML('beforeend',feeComponentRowHtml(item||{},index));
    box.querySelectorAll('input,select').forEach(x=>x.oninput=recalcFeeComponentTotal);
    recalcFeeComponentTotal();
  };
  window.recalcFeeComponentTotal=function(){
    const values=[...document.querySelectorAll('#feeComponentRows [data-component-field="amount"]')].map(x=>Number(x.value||0)).filter(Number.isFinite);
    const total=values.reduce((a,b)=>a+b,0);
    const el=document.getElementById('feeComponentsTotal');if(el)el.textContent=money(total);
  };
  function collectFeeComponents(){
    return [...document.querySelectorAll('#feeComponentRows .fee-component-row')].map(row=>({
      type:row.querySelector('[data-component-field="type"]')?.value||'',
      amount:Number(row.querySelector('[data-component-field="amount"]')?.value||0),
      description:row.querySelector('[data-component-field="description"]')?.value.trim()||''
    })).filter(x=>x.type&&(x.amount||x.description));
  }

  function scheduleRowHtml(item,index){
    item=item||{};
    const label=String(item.label||'Instalment 1');
    const due=String(item.due||'Month 1');
    return `<div class="fee-schedule-row" data-index="${index}" style="display:grid;grid-template-columns:1.1fr .8fr 1fr 1.2fr auto;gap:8px;align-items:end;margin-bottom:8px">
      <div class="field"><label>Payment</label><select data-fee-field="label">${optionsHtml(PAYMENT_LABELS,label)}</select></div>
      <div class="field"><label>Amount (RM)</label><input data-fee-field="amount" type="number" min="0" step="0.01" value="${item.amount!==undefined?esc(item.amount):''}" /></div>
      <div class="field"><label>Due</label><select data-fee-field="due">${optionsHtml(PAYMENT_DUE,due)}</select></div>
      <div class="field"><label>Notes</label><input data-fee-field="notes" value="${esc(item.notes||'')}" placeholder="Optional" /></div>
      <button type="button" class="ghost" onclick="removeFeeScheduleRow(this)">Remove</button>
    </div>`;
  }
  window.removeFeeScheduleRow=function(btn){btn.closest('.fee-schedule-row')?.remove();recalcFeeScheduleTotal()};
  window.addFeeScheduleRow=function(item){
    const box=document.getElementById('feeScheduleRows');if(!box)return;
    const index=box.querySelectorAll('.fee-schedule-row').length;
    box.insertAdjacentHTML('beforeend',scheduleRowHtml(item||{},index));
    box.querySelectorAll('input').forEach(x=>x.oninput=recalcFeeScheduleTotal);
    recalcFeeScheduleTotal();
  };
  window.recalcFeeScheduleTotal=function(){
    const values=[...document.querySelectorAll('#feeScheduleRows [data-fee-field="amount"]')].map(x=>Number(x.value||0)).filter(Number.isFinite);
    const total=values.reduce((a,b)=>a+b,0);
    const el=document.getElementById('feeScheduleTotal');if(el)el.textContent=money(total);
  };
  function collectSchedule(){
    return [...document.querySelectorAll('#feeScheduleRows .fee-schedule-row')].map(row=>({
      label:row.querySelector('[data-fee-field="label"]')?.value.trim()||'',
      amount:Number(row.querySelector('[data-fee-field="amount"]')?.value||0),
      due:row.querySelector('[data-fee-field="due"]')?.value.trim()||'',
      notes:row.querySelector('[data-fee-field="notes"]')?.value.trim()||''
    })).filter(x=>x.label||x.amount||x.due||x.notes);
  }

  window.openFeeStructureModal=function(code){
    closeFeeModal();
    const row=code?rows().find(x=>String(x['Fee Group Code']||'')===String(code)):null;
    const editing=!!row;
    const existingSchedule=row?schedule(row):[];
    const overlay=document.createElement('div');
    overlay.id='feeStructureModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.6);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto';
    overlay.innerHTML=`
      <div style="width:min(1000px,97vw);background:#fff;border-radius:20px;box-shadow:0 28px 80px rgba(0,0,0,.28);padding:24px;margin:auto">
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px">
          <div><h2 style="margin:0 0 5px">${editing?'Edit':'Add'} Fee Structure</h2><div class="subline">This master controls the Fee Group list used by Academic Consultants / Marketing.</div></div>
          <button class="ghost" type="button" onclick="document.getElementById('feeStructureModal')?.remove()">Close</button>
        </div>

        <div class="detail-grid">
          <div class="field"><label>Fee Group Code *</label><input id="feeCode" value="${esc(row?.['Fee Group Code']||'')}" ${editing?'readonly':''} placeholder="e.g. MBA-15000" /></div>
          <div class="field"><label>Fee Structure Name</label><input id="feeName" value="${esc(row?.['Fee Structure Name']||'')}" placeholder="e.g. MBA Standard Fee 2026" /></div>
          <div class="field full"><label>Programme</label><select id="feeProgramme">${optionsHtml(programmeOptions(),row?.['Programme']||'ALL')}</select></div>
          <div class="field"><label>Level</label><select id="feeLevel">${optionsHtml(LEVELS,row?.['Level']||'ALL')}</select></div>
          <div class="field"><label>Study Mode</label><select id="feeStudyMode">${optionsHtml(STUDY_MODES,row?.['Study Mode']||'ALL')}</select></div>
          <div class="field"><label>Intake Scope</label><select id="feeIntake">${optionsHtml(intakeOptions(),row?.['Intake Scope']||'ALL')}</select></div>
          <div class="field"><label>Effective From</label><input id="feeEffectiveFrom" type="date" value="${esc(row?.['Effective From']||'')}" /></div>
          <div class="field"><label>Effective Until</label><input id="feeEffectiveUntil" type="date" value="${esc(row?.['Effective Until']||'')}" /></div>
        </div>

        <div class="panel" style="box-shadow:none;margin-top:16px">
          <div class="panel-head"><div><h3 style="margin:0">Fee Components</h3><span>Standardised academic / non-academic fee classification</span></div><button type="button" class="ghost" onclick="addFeeComponentRow()">+ Add Component</button></div>
          <div class="panel-body">
            <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin:0 0 14px">
              Academic fee categories follow the KPT distinction between <b>Coursework Fee</b>, <b>Research Fee</b> and <b>Mixed-Mode Fee</b>. Registration and other approved non-academic charges are recorded separately.
            </div>
            <div id="feeComponentRows"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;align-items:center;border-top:1px solid var(--line);padding-top:12px"><span class="subline">Fee Structure Total</span><strong id="feeComponentsTotal">RM 0.00</strong></div>
          </div>
        </div>

        <div class="panel" style="box-shadow:none;margin-top:16px">
          <div class="panel-head"><div><h3 style="margin:0">Payment Schedule</h3><span>How the approved total fee is expected to be paid over time</span></div><button type="button" class="ghost" onclick="addFeeScheduleRow()">+ Add Payment</button></div>
          <div class="panel-body">
            <div class="message" style="display:block;background:var(--purpleSoft);color:var(--purple);margin:0 0 14px">
              Payment Schedule does <b>not</b> collect payment and does not create an invoice. It records the approved payment sequence for this Fee Group — for example Registration Fee upon registration, followed by Instalment 1 in Month 1, Instalment 2 in Month 2, and so on. This schedule can later be reused by Bursary / payment tracking.
            </div>
            <div id="feeScheduleRows"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;align-items:center;border-top:1px solid var(--line);padding-top:12px"><span class="subline">Schedule Total</span><strong id="feeScheduleTotal">RM 0.00</strong></div>
          </div>
        </div>

        <div class="panel" style="box-shadow:none;margin-top:16px">
          <div class="panel-head"><h3>Agent Availability & PDF</h3><span>Only ACTIVE structures appear to agents</span></div>
          <div class="panel-body">
            <div class="detail-grid">
              <div class="field full"><label>Fee Structure PDF (Google Drive URL or File ID)</label><input id="feePdf" value="${esc(row?.['File ID PDF']||'')}" placeholder="Paste Drive link or File ID" /></div>
              <div class="field"><label>Status</label><select id="feeActive"><option value="INACTIVE">INACTIVE</option><option value="ACTIVE">ACTIVE</option></select></div>
              <div class="field"><label>Notes</label><input id="feeNotes" value="${esc(row?.['Notes']||'')}" placeholder="Internal note" /></div>
            </div>
            <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-top:10px;line-height:1.55">
              <b>Agent Availability:</b> ACTIVE means this Fee Group appears in the agent dropdown for the applicable programme. INACTIVE hides it from new selections without deleting historical records.<br><br>
              <b>Fee Structure PDF:</b> paste the approved fee-structure document from Google Drive. The PDF acts as the official reference mapped to the Fee Group after the agent selects it. A structure cannot be activated until the PDF is accessible.
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
          <button class="ghost" type="button" onclick="document.getElementById('feeStructureModal')?.remove()">Cancel</button>
          <button class="primary" type="button" id="saveFeeStructureBtn">Save Fee Structure</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('feeActive').value=(editing&&active(row))?'ACTIVE':'INACTIVE';
    const existingComponents=row?components(row):[];
    if(existingComponents.length)existingComponents.forEach(x=>addFeeComponentRow(x));else addFeeComponentRow({type:'COURSEWORK_FEE'});
    if(existingSchedule.length)existingSchedule.forEach(x=>addFeeScheduleRow(x));else addFeeScheduleRow();
    document.getElementById('saveFeeStructureBtn').onclick=saveFeeStructure;
  };

  window.saveFeeStructure=async function(){
    const code=document.getElementById('feeCode')?.value.trim()||'';
    const payload={
      feeGroupCode:code,
      feeStructureName:document.getElementById('feeName')?.value.trim()||'',
      programme:document.getElementById('feeProgramme')?.value.trim()||'ALL',
      level:document.getElementById('feeLevel')?.value.trim()||'',
      studyMode:document.getElementById('feeStudyMode')?.value.trim()||'',
      intakeScope:document.getElementById('feeIntake')?.value.trim()||'ALL',
      effectiveFrom:document.getElementById('feeEffectiveFrom')?.value||'',
      effectiveUntil:document.getElementById('feeEffectiveUntil')?.value||'',
      feeComponents:collectFeeComponents(),
      paymentSchedule:collectSchedule(),
      fileIdPdf:document.getElementById('feePdf')?.value.trim()||'',
      active:document.getElementById('feeActive')?.value||'INACTIVE',
      notes:document.getElementById('feeNotes')?.value.trim()||''
    };
    if(!code)return feeMsg('Fee Group Code is required.','error');
    const result=await feeAction('v2UpsertFeeStructure',payload,'Save this Fee Structure?');
    if(!result)return;
    closeFeeModal();
    feeMsg('Fee Structure '+result.feeGroupCode+' saved successfully. Agent master list has been refreshed.','ok');
  };

  window.setFeeStructureStatus=async function(code,toActive){
    const result=await feeAction('v2SetFeeStructureStatus',{feeGroupCode:code,active:toActive?'ACTIVE':'INACTIVE'},
      (toActive?'Activate ':'Deactivate ')+code+'?');
    if(result)feeMsg(code+' is now '+result.active+'.','ok');
  };

  function closeFeeDetail(){document.getElementById('feeStructureDetailModal')?.remove()}
  window.openFeeStructureDetail=function(code){
    const row=rows().find(x=>String(x['Fee Group Code']||'')===String(code));
    if(!row)return feeMsg('Fee Structure not found.','error');
    closeFeeDetail();
    const plan=schedule(row);
    const used=(db.V2_APPLICATIONS||[]).filter(x=>String(x['Fee Group']||'')===String(code)).length;
    const isActive=active(row);
    const fileId=String(row['File ID PDF']||'').trim();
    const overlay=document.createElement('div');
    overlay.id='feeStructureDetailModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.62);z-index:9998;display:flex;justify-content:center;align-items:flex-start;padding:20px;overflow:auto';
    overlay.innerHTML=`
      <div style="width:min(980px,97vw);background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.28);overflow:hidden;margin:auto">
        <div style="padding:22px 26px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:14px">
          <div><h2 style="margin:0 0 5px">${esc(row['Fee Structure Name']||code)}</h2><div class="subline">${esc(code)} · ${esc(row['Programme']||'ALL')}</div></div>
          <button class="ghost" onclick="document.getElementById('feeStructureDetailModal')?.remove()">Close</button>
        </div>
        <div style="padding:24px 26px">
          <div style="border:1px solid #ddd8f2;background:#fbfaff;border-radius:18px;padding:18px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
              <div><div style="font-size:12px;font-weight:900;color:var(--purple);margin-bottom:5px">Agent Preview</div><div style="font-size:17px;font-weight:900">${esc(optionLabel(row))}</div><div class="subline" style="margin-top:4px">This is the label the agent will see when selecting the Fee Group.</div></div>
              <span class="badge ${isActive?'green':'amber'}">${isActive?'ACTIVE FOR AGENT':'INACTIVE'}</span>
            </div>
            <div class="orientation-actions" style="margin-top:14px">
              <button class="primary" onclick="document.getElementById('feeStructureDetailModal')?.remove();openFeeStructureModal('${esc(code)}')">Edit Fee Structure</button>
              <button class="ghost" onclick="document.getElementById('feeStructureDetailModal')?.remove();setFeeStructureStatus('${esc(code)}',${!isActive})">${isActive?'Deactivate':'Activate'}</button>
              ${fileId?`<a class="ghost" href="${fileUrlFromId(fileId)}" target="_blank" rel="noopener" style="text-decoration:none">Open PDF</a>`:''}
            </div>
          </div>
          <div class="detail-grid">
            <div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Fee Summary</h3></div><div class="panel-body">
              <div class="detail-grid">
                <div><div class="subline">Tuition Fee</div><div class="student">${money(row['Tuition Fee'])}</div></div>
                <div><div class="subline">Registration Fee</div><div class="student">${money(row['Registration Fee'])}</div></div>
                <div><div class="subline">Other Fee</div><div class="student">${money(row['Other Fee'])}</div></div>
                <div><div class="subline">Total Fee</div><div class="student">${money(row['Total Fee'])}</div></div>
                <div><div class="subline">Study Mode</div><div class="student">${esc(row['Study Mode']||'-')}</div></div>
                <div><div class="subline">Intake Scope</div><div class="student">${esc(row['Intake Scope']||'ALL')}</div></div>
              </div>
            </div></div>
            <div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Usage</h3></div><div class="panel-body">
              <div class="kpi" style="box-shadow:none;padding:12px"><div class="label">APPLICATIONS USING THIS FEE GROUP</div><div class="value" style="font-size:26px">${used}</div></div>
              <div class="subline" style="margin-top:10px">Effective: ${esc(row['Effective From']||'Not set')} → ${esc(row['Effective Until']||'No end date')}</div>
            </div></div>
          </div>
          <div class="panel" style="box-shadow:none;margin-top:16px"><div class="panel-head"><h3>Payment Schedule</h3><span>${plan.length} payment item(s)</span></div>
            <div class="table-wrap"><table><thead><tr><th>#</th><th>Payment</th><th>Amount</th><th>Due</th><th>Notes</th></tr></thead><tbody>
              ${plan.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.label||'-')}</td><td>${money(x.amount)}</td><td>${esc(x.due||'-')}</td><td>${esc(x.notes||'-')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No payment schedule configured.</td></tr>'}
            </tbody></table></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  };

  window.renderFeeStructure=function(){
    const list=rows();
    const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n};
    set('feeTotalKpi',list.length);
    set('feeActiveKpi',list.filter(active).length);
    set('feeInactiveKpi',list.filter(x=>!active(x)).length);
    set('feePdfKpi',list.filter(x=>String(x['File ID PDF']||'').trim()).length);

    const body=document.getElementById('feeStructureBody');if(!body)return;
    body.innerHTML=list.slice().sort((a,b)=>String(a['Fee Group Code']||'').localeCompare(String(b['Fee Group Code']||''))).map(row=>{
      const code=String(row['Fee Group Code']||'');
      const plan=schedule(row);
      const isActive=active(row);
      return `<tr>
        <td><div class="student">${esc(code)}</div><div class="subline">${esc(row['Fee Structure Name']||'')}</div></td>
        <td>${esc(row['Programme']||'ALL')}<div class="subline">${esc([row['Study Mode'],row['Intake Scope']].filter(Boolean).join(' · '))}</div></td>
        <td><div class="student">${money(row['Total Fee'])}</div><div class="subline">Tuition ${money(row['Tuition Fee'])}</div></td>
        <td>${plan.length}<div class="subline">${plan.length?'schedule item(s)':'No schedule'}</div></td>
        <td><span class="badge ${isActive?'green':'amber'}">${isActive?'ACTIVE':'INACTIVE'}</span><div class="subline">${String(row['File ID PDF']||'').trim()?'PDF Ready':'PDF Missing'}</div></td>
        <td><button class="primary" onclick="openFeeStructureDetail('${esc(code)}')">View Fee Structure</button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="empty">No Fee Structure has been configured yet.</td></tr>';
  };

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){baseRenderAll();renderFeeStructure()};
  }
})();