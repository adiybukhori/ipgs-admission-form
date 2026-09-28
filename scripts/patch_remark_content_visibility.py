from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')

# Ensure persisted remark text is written into the V2_AGENT_EVENTS fields that backend actually stores.
old_payload="""          remark,
          note:remark,
          message:remark,
          details:remark,
          timestamp:now,
          updatedBy:'Admin Portal V2'"""
new_payload="""          remark,
          note:remark,
          message:remark,
          details:remark,
          summary:remark,
          data:{remark},
          timestamp:now,
          updatedBy:'Admin Portal V2'"""
if old_payload in s and 'summary:remark' not in s:
    s=s.replace(old_payload,new_payload,1)

# Read Summary too when rebuilding persisted remarks from V2_AGENT_EVENTS.
old_norm="""'Remark':x['Remark']||x['Details']||x['Message']||x['Note']||x['Description']||x['remark']||x['details']||x['message']||x['note']||''"""
new_norm="""'Remark':x['Remark']||x['Details']||x['Message']||x['Note']||x['Description']||x['Summary']||x['remark']||x['details']||x['message']||x['note']||x['summary']||''"""
if old_norm in s:
    s=s.replace(old_norm,new_norm,1)

# Show Summary as visible remark body in Activity / Remarks.
old_note="""const note=a['Remark']||a['Details']||a['Message']||a['Note']||a['Description']||'';"""
new_note="""const note=a['Remark']||a['Details']||a['Message']||a['Note']||a['Description']||a['Summary']||a['summary']||'';"""
if old_note in s:
    s=s.replace(old_note,new_note,1)

p.write_text(s,encoding='utf-8')
print('REMARK_CONTENT_VISIBILITY_PATCHED')
