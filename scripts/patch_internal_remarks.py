from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')

# Rename applicant tab to make the feature discoverable.
s=s.replace('>Activity</button></div>','>Activity / Remarks</button></div>',1)

# Replace the V2 Activity tab renderer with a remarks composer + audit history.
old="""const audit=(r.audit||[]).map(a=>`<div class=\"audit-item\"><div class=\"t\">${esc(a['Action']||a['Event']||a['Activity']||'Workflow update')}</div><div class=\"m\">${esc(formatDate(a['Timestamp']||a['Created At']||a['Updated At']||''))} ${esc(a['Updated By']||a['Actor']||'')}</div></div>`).join('');document.getElementById('tab-activity').innerHTML=`<div class=\"audit\">${audit||'<div class=\"empty\">No audit activity found for this reference.</div>'}</div>`}"""
new="""const audit=(r.audit||[]).map(a=>{const title=a['Action']||a['Event']||a['Activity']||'Workflow update';const note=a['Remark']||a['Details']||a['Message']||a['Note']||a['Description']||'';const isRemark=String(title).toUpperCase().includes('INTERNAL_REMARK')||String(a['Type']||'').toUpperCase()==='INTERNAL_REMARK';return `<div class=\"audit-item${isRemark?' internal-remark-item':''}\"><div class=\"t\">${isRemark?'📝 Internal Remark':esc(title)}</div><div class=\"m\">${esc(formatDate(a['Timestamp']||a['Created At']||a['Updated At']||''))} ${esc(a['Updated By']||a['Actor']||a['Agent ID']||'')}</div>${note?`<div style=\"margin-top:6px;line-height:1.5;color:var(--ink)\">${esc(note)}</div>`:''}</div>`}).join('');document.getElementById('tab-activity').innerHTML=`<div class=\"internal-remark-box\"><div style=\"font-weight:850;margin-bottom:5px\">Internal Remarks</div><div style=\"font-size:11px;color:var(--muted);margin-bottom:10px\">For staff reference only. Remarks do not change the applicant's workflow or status.</div><textarea id=\"internalRemarkText\" class=\"internal-remark-textarea\" placeholder=\"Add a private internal remark for this applicant...\"></textarea><div style=\"display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:9px\"><button class=\"primary\" type=\"button\" onclick=\"saveInternalRemark()\">Save Remark</button><span id=\"internalRemarkStatus\" style=\"font-size:11px;color:var(--muted)\"></span></div></div><div class=\"audit\">${audit||'<div class=\"empty\">No activity or remarks found for this reference.</div>'}</div>`}"""
if old not in s:
    raise SystemExit('activity renderer anchor not found')
s=s.replace(old,new,1)

# Add remark save function before detailTab.
anchor="""    function detailTab(name,btn){"""
fn="""    async function saveInternalRemark(){
      if(!selected||!selected.ref)return;
      const input=document.getElementById('internalRemarkText');
      const statusEl=document.getElementById('internalRemarkStatus');
      const remark=String(input?.value||'').trim();
      if(!remark){if(statusEl)statusEl.textContent='Enter a remark first.';return}
      if(statusEl)statusEl.textContent='Saving…';
      try{
        const now=new Date().toISOString();
        const payload={
          referenceNo:selected.ref,
          agentId:'ADMIN_PORTAL',
          executionId:'REMARK-'+Date.now(),
          action:'INTERNAL_REMARK',
          activity:'INTERNAL_REMARK',
          type:'INTERNAL_REMARK',
          status:'RECORDED',
          remark,
          note:remark,
          message:remark,
          details:remark,
          timestamp:now,
          updatedBy:'Admin Portal V2'
        };
        const out=await runAdminAction('v2RecordAgentActivity',payload);
        if(!out)return;
        selected.audit=selected.audit||[];
        selected.audit.unshift({'Action':'INTERNAL_REMARK','Type':'INTERNAL_REMARK','Remark':remark,'Timestamp':now,'Updated By':'Admin Portal V2'});
        if(input)input.value='';
        renderDetailTabs(selected);
        const tab=document.getElementById('tab-activity');if(tab)tab.classList.add('active');
        document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
        const btn=[...document.querySelectorAll('.tabs button')].find(x=>x.textContent.includes('Activity / Remarks'));if(btn)btn.classList.add('active');
        const refreshedStatus=document.getElementById('internalRemarkStatus');if(refreshedStatus)refreshedStatus.textContent='Remark saved.';
      }catch(e){if(statusEl)statusEl.textContent=e.message||'Unable to save remark.'}
    }

"""+anchor
if anchor not in s:
    raise SystemExit('detailTab anchor not found')
s=s.replace(anchor,fn,1)

# Add simple styling near existing audit styles if available, otherwise before </style>.
css="""
    .internal-remark-box{border:1px solid #ddd8f3;background:#faf9ff;border-radius:14px;padding:14px;margin-bottom:14px}
    .internal-remark-textarea{width:100%;min-height:96px;resize:vertical;border:1px solid #d7dce6;border-radius:12px;padding:11px 12px;font:inherit;color:var(--ink);background:#fff;outline:none}
    .internal-remark-textarea:focus{border-color:#9688d1;box-shadow:0 0 0 3px rgba(75,53,162,.09)}
    .internal-remark-item{border-left:4px solid var(--purple);background:#faf9ff}
"""
s=s.replace('</style>',css+'  </style>',1)

p.write_text(s,encoding='utf-8')
print('INTERNAL_REMARKS_PATCHED')
