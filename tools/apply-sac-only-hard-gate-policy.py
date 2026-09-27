from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        print(f'{label}: already patched')
        return text
    if old not in text:
        raise SystemExit(f'{label}: anchor not found')
    return text.replace(old, new, 1)

# ------------------------------------------------------------
# Document Review: missing documents remain visible/followed up,
# but do not stop academic screening before the SAC gate.
# ------------------------------------------------------------
p = Path('apps-script-v2/DocumentReviewV2.js')
text = p.read_text(encoding='utf-8')

text = replace_once(
    text,
    """  if (\n    currentStage !== 'APPLICATION_RECEIVED' &&\n    currentStage !== 'DOCUMENT_REVIEW'\n  ) {\n    throw new Error(\n      'Document review is not available at current stage: ' +\n      currentStage\n    );\n  }""",
    """  if (\n    ['APPLICATION_RECEIVED','DOCUMENT_REVIEW','QUALIFICATION_SCREENING','READY_FOR_SAC','SAC_REVIEW']\n      .indexOf(currentStage) < 0\n  ) {\n    throw new Error(\n      'Document review is not available at current stage: ' +\n      currentStage\n    );\n  }""",
    'DocumentReview stage refresh'
)

text = replace_once(
    text,
    """  // Current operational rule: every required item blocks Stage 2.\n  // PhD Preliminary Research Intent is an additional mandatory document.\n  const outstandingDocuments = [];\n  const missingDocuments = allMissingDocuments;\n\n  const status =\n    missingDocuments.length === 0 ? 'COMPLETE' : 'INCOMPLETE';""",
    """  // SAC-only hard-gate policy:\n  // missing required items are followed up in parallel, but they do not block\n  // document review / academic screening. The unresolved items are carried\n  // forward and enforced only when the applicant is assigned into SAC.\n  const outstandingDocuments = [];\n  const missingDocuments = allMissingDocuments;\n\n  const status =\n    missingDocuments.length === 0 ? 'COMPLETE' : 'COMPLETE_WITH_FLAGS';""",
    'DocumentReview status policy'
)

text = replace_once(
    text,
    """  if (status === 'COMPLETE') {\n    try {""",
    """  if (status === 'COMPLETE' || status === 'COMPLETE_WITH_FLAGS') {\n    try {""",
    'DocumentReview handoff policy'
)

# Emit student follow-up in parallel before routing onward.
anchor = """  let autoAiScreening = null;\n  let agenticHandoff = null;\n  if (status === 'COMPLETE' || status === 'COMPLETE_WITH_FLAGS') {\n    try {"""
insert = """  let autoAiScreening = null;\n  let agenticHandoff = null;\n\n  // Missing-document follow-up is parallel work, not a pre-SAC stop.\n  if (missingDocuments.length && typeof v2EmitAgentEvent_ === 'function') {\n    try {\n      v2EmitAgentEvent_({\n        referenceNo:reference,\n        eventType:'DOCUMENT_MISSING_REQUIRED',\n        agentId:'ORCHESTRATOR',\n        agentName:'AI Orchestrator',\n        action:'ROUTE_STUDENT_CONCIERGE',\n        status:'QUEUED',\n        fromStage:currentStage,\n        toStage:currentStage,\n        requiresHuman:false,\n        source:'ADMISSION_V2',\n        summary:'Required document(s) are pending. Student follow-up continues in parallel while screening proceeds to the SAC gate.',\n        data:{missingDocuments:missingDocuments, missingCount:missingDocuments.length}\n      });\n    } catch (followUpEventError) {\n      Logger.log('Missing-document follow-up event failed non-blocking: ' + String(followUpEventError));\n    }\n  }\n\n  if (status === 'COMPLETE' || status === 'COMPLETE_WITH_FLAGS') {\n    try {"""
text = replace_once(text, anchor, insert, 'DocumentReview parallel follow-up')

text = replace_once(
    text,
    """    nextAction:\n      status === 'COMPLETE'\n        ? (""",
    """    nextAction:\n      (status === 'COMPLETE' || status === 'COMPLETE_WITH_FLAGS')\n        ? (""",
    'DocumentReview next action policy'
)

text = replace_once(
    text,
    """    manualScreeningAvailable: status === 'COMPLETE',""",
    """    manualScreeningAvailable: status === 'COMPLETE' || status === 'COMPLETE_WITH_FLAGS',""",
    'DocumentReview manual availability'
)

text = replace_once(
    text,
    """    applicationStage: 'DOCUMENT_REVIEW',""",
    """    applicationStage: currentStage === 'APPLICATION_RECEIVED' ? 'DOCUMENT_REVIEW' : currentStage,""",
    'DocumentReview preserve stage'
)

p.write_text(text, encoding='utf-8')

# ------------------------------------------------------------
# Agentic Bridge: remove pre-SAC document/quality hard blocks and
# allow safe rechecks after late uploads while preserving stage.
# ------------------------------------------------------------
p = Path('apps-script-v2/AgenticBridgeV2.js')
text = p.read_text(encoding='utf-8')

text = replace_once(
    text,
    """      if (['APPLICATION_RECEIVED','DOCUMENT_REVIEW'].indexOf(currentStage) < 0) {\n        throw new Error('Document completeness check is not available at current stage: ' + currentStage);\n      }""",
    """      if (['APPLICATION_RECEIVED','DOCUMENT_REVIEW','QUALIFICATION_SCREENING','READY_FOR_SAC','SAC_REVIEW'].indexOf(currentStage) < 0) {\n        throw new Error('Document completeness check is not available at current stage: ' + currentStage);\n      }""",
    'Bridge document refresh stages'
)

text = replace_once(
    text,
    """      if (String(result.status||'').toUpperCase()==='INCOMPLETE' && typeof v2EmitAgentEvent_==='function') {""",
    """      if (Number(result.missingCount||0)>0 && typeof v2EmitAgentEvent_==='function') {""",
    'Bridge missing event condition'
)

text = replace_once(
    text,
    """      if (!doc || String(doc.record['Review Status'] || '') !== 'COMPLETE') {\n        throw new Error('Compliance review blocked: deterministic document completeness is not COMPLETE.');\n      }\n      if (currentStage !== 'DOCUMENT_REVIEW') {\n        throw new Error('Compliance review is not available at current stage: ' + currentStage);\n      }""",
    """      const documentReviewStatus = String(doc && doc.record['Review Status'] || '').toUpperCase();\n      if (!doc || ['COMPLETE','COMPLETE_WITH_FLAGS'].indexOf(documentReviewStatus) < 0) {\n        throw new Error('Compliance review blocked: deterministic document review has not completed.');\n      }\n      if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING','READY_FOR_SAC','SAC_REVIEW'].indexOf(currentStage) < 0) {\n        throw new Error('Compliance review is not available at current stage: ' + currentStage);\n      }""",
    'Bridge compliance gate'
)

old_admission = """      if (!doc || String(doc.record['Review Status'] || '') !== 'COMPLETE') {\n        throw new Error('Admission Intelligence blocked: document review is not COMPLETE.');\n      }\n      if (v2AgenticEnabled_()) {\n        const qualityStatus = String(\n          doc.record['AI Quality Status'] ||\n          workflow.record['Document Quality Status'] || ''\n        ).toUpperCase();\n        if (qualityStatus !== 'PASS') {\n          throw new Error('Admission Intelligence blocked: Compliance & Records quality status is not PASS.');\n        }\n      }\n      if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(currentStage) < 0) {\n        throw new Error('Admission Intelligence is not available at current stage: ' + currentStage);\n      }"""
new_admission = """      const documentReviewStatus = String(doc && doc.record['Review Status'] || '').toUpperCase();\n      if (!doc || ['COMPLETE','COMPLETE_WITH_FLAGS'].indexOf(documentReviewStatus) < 0) {\n        throw new Error('Admission Intelligence blocked: document review has not completed.');\n      }\n      // SAC-only hard-gate policy: Compliance flags (including\n      // FOLLOW_UP_REQUIRED) are carried into screening and the official report.\n      // Student follow-up continues independently; only SAC may hard-block.\n      if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING','READY_FOR_SAC','SAC_REVIEW'].indexOf(currentStage) < 0) {\n        throw new Error('Admission Intelligence is not available at current stage: ' + currentStage);\n      }"""
text = replace_once(text, old_admission, new_admission, 'Bridge admission intelligence gate')

old_missing = """      const reviewStatus=String(\n        doc && doc.record['Review Status'] ||\n        workflow.record['Document Review Status'] || ''\n      ).toUpperCase();\n      if (reviewStatus !== 'INCOMPLETE') {\n        throw new Error('Missing-document request blocked: Document Review Status is not INCOMPLETE.');\n      }"""
new_missing = """      let missingDocuments=[];\n      try { missingDocuments=JSON.parse(String(doc && doc.record['Missing Documents JSON'] || '[]')); } catch (_) { missingDocuments=[]; }\n      const missingCount=Math.max(\n        Number(workflow.record['Missing Document Count']||0),\n        Array.isArray(missingDocuments) ? missingDocuments.length : 0\n      );\n      if (missingCount <= 0) {\n        throw new Error('Missing-document request blocked: no pending required document was found.');\n      }"""
text = replace_once(text, old_missing, new_missing, 'Bridge missing request gate')

p.write_text(text, encoding='utf-8')

print('SAC-only hard-gate policy source patch complete.')
