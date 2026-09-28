from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')

# 1) Add helper functions before renderApplications.
anchor="    function renderApplications(){"
helpers="""    function internalRemarksFor(r){
      return (r?.audit||[]).filter(a=>{
        const action=String(a?.['Action']||a?.['Event']||a?.['Activity']||'').toUpperCase();
        const type=String(a?.['Type']||'').toUpperCase();
        return action.includes('INTERNAL_REMARK')||type==='INTERNAL_REMARK';
      });
    }
    function latestInternalRemark(r){
      const rows=internalRemarksFor(r);
      if(!rows.length)return null;
      return rows.slice().sort((a,b)=>{
        const ta=Date.parse(a?.['Timestamp']||a?.['Created At']||a?.['Updated At']||'')||0;
        const tb=Date.parse(b?.['Timestamp']||b?.['Created At']||b?.['Updated At']||'')||0;
        return tb-ta;
      })[0];
    }
    function openApplicantRemarks(ref){
      openRecord(ref);
      requestAnimationFrame(()=>{
        const btn=[...document.querySelectorAll('.tabs button')].find(x=>x.textContent.includes('Activity / Remarks'));
        if(btn)detailTab('activity',btn);
      });
    }
"""+anchor
if 'function internalRemarksFor(r)' not in s:
    if anchor not in s:
        raise SystemExit('renderApplications anchor not found')
    s=s.replace(anchor,helpers,1)

# 2) Replace the application-list Action cell so applicants with remarks visibly show a right-most Remark button.
old="""<td><button class=\"ghost\" onclick=\"openRecord('${esc(r.ref)}')\">Open</button></td></tr>"""
new="""<td><div class=\"application-row-actions\"><button class=\"ghost\" onclick=\"openRecord('${esc(r.ref)}')\">Open</button>${latestInternalRemark(r)?`<button class=\"ghost remark-indicator-btn\" title=\"${esc(latestInternalRemark(r)['Remark']||latestInternalRemark(r)['Details']||latestInternalRemark(r)['Message']||latestInternalRemark(r)['Note']||'Internal remark available')}\" onclick=\"openApplicantRemarks('${esc(r.ref)}')\">📝 Remark</button>`:''}</div></td></tr>"""
if old not in s:
    raise SystemExit('application action cell anchor not found')
s=s.replace(old,new,1)

# 3) Ensure the row updates immediately after saving a remark.
save_anchor="""        selected.audit.unshift({'Action':'INTERNAL_REMARK','Type':'INTERNAL_REMARK','Remark':remark,'Timestamp':now,'Updated By':'Admin Portal V2'});
        if(input)input.value='';"""
save_new="""        selected.audit.unshift({'Action':'INTERNAL_REMARK','Type':'INTERNAL_REMARK','Remark':remark,'Timestamp':now,'Updated By':'Admin Portal V2'});
        renderApplications();
        if(input)input.value='';"""
if save_anchor in s and 'selected.audit.unshift' in s:
    s=s.replace(save_anchor,save_new,1)

# 4) Add compact styling.
css="""
    .application-row-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
    .remark-indicator-btn{border-color:#d9d2f4;background:#f7f5ff;color:var(--purple);white-space:nowrap}
    .remark-indicator-btn:hover{background:var(--purpleSoft);border-color:#c9bff1}
"""
if '.remark-indicator-btn{' not in s:
    s=s.replace('</style>',css+'  </style>',1)

p.write_text(s,encoding='utf-8')
print('APPLICATION_REMARK_INDICATOR_PATCHED')
