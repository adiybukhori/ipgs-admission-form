/**
 * IUC IPGS Admission V2 - Manual Document Review
 * Registry second-layer review for cases where documents must be visually checked.
 */

function v2CompleteManualDocumentReview_(data, reviewer) {
  assertDevIdentity_();

  const reference = String(data && data.referenceNo || '').trim();
  const reviewedBy = String(reviewer || data && data.reviewer || 'Admin Portal V2').trim();
  const remarks = String(data && data.remarks || '').trim();
  const decisionsInput = Array.isArray(data && data.decisions) ? data.decisions : [];

  if (!reference) throw new Error('Reference No is required.');
  if (!decisionsInput.length) throw new Error('Manual document decisions are required.');

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!application) throw new Error('V2 application record not found.');
  if (!workflow) throw new Error('V2 workflow record not found.');

  const currentStage = String(workflow.record['Application Stage'] || '').trim();
  if (['APPLICATION_RECEIVED', 'DOCUMENT_REVIEW'].indexOf(currentStage) < 0) {
    throw new Error('Manual document review is not available at current stage: ' + currentStage);
  }

  if (currentStage === 'APPLICATION_RECEIVED') {
    v2UpdateStage_({
      referenceNo: reference,
      stage: 'DOCUMENT_REVIEW',
      remarks: 'Manual document review started.'
    }, reviewedBy);
  }

  const requiredDocuments = v2GetRequiredDocuments_(application.record);
  const submittedDocuments = v2GetSubmittedDocuments_(application.record);
  const submittedByKey = {};
  submittedDocuments.forEach(function(doc) {
    submittedByKey[String(doc.field || '').trim()] = doc;
  });

  const decisionByKey = {};
  decisionsInput.forEach(function(item) {
    const key = String(item && item.key || '').trim();
    const status = String(item && item.status || '').trim().toUpperCase();
    if (!key) return;
    if (['VERIFIED', 'MISSING', 'NOT_ACCEPTABLE', 'OUTSTANDING'].indexOf(status) < 0) {
      throw new Error('Invalid manual document status for ' + key + '.');
    }
    if (status === 'OUTSTANDING' && key !== 'preliminaryResearchIntent') {
      throw new Error('OUTSTANDING is only allowed for Preliminary Research Intent.');
    }
    decisionByKey[key] = {
      key: key,
      label: String(item.label || V2_DOCUMENT_LABELS[key] || key),
      status: status,
      remarks: String(item.remarks || '').trim(),
      fileName: submittedByKey[key] ? String(submittedByKey[key].fileName || '') : '',
      url: submittedByKey[key] ? String(submittedByKey[key].url || '') : ''
    };
  });

  const decisions = requiredDocuments.map(function(doc) {
    const item = decisionByKey[doc.key];
    if (!item) throw new Error('Manual decision is required for ' + doc.label + '.');
    if (!submittedByKey[doc.key] && item.status === 'VERIFIED') {
      throw new Error(doc.label + ' cannot be VERIFIED because no uploaded file is recorded.');
    }
    return item;
  });

  const outstandingDocuments = decisions.filter(function(item) {
    return item.status === 'OUTSTANDING';
  });
  const problemDocuments = decisions.filter(function(item) {
    return item.status !== 'VERIFIED' && item.status !== 'OUTSTANDING';
  });
  const status = problemDocuments.length ? 'INCOMPLETE' : 'COMPLETE';
  const now = new Date().toISOString();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let reviewSheet = ss.getSheetByName(V2_DOCUMENT_REVIEW_SHEET);
  if (!reviewSheet) reviewSheet = ss.insertSheet(V2_DOCUMENT_REVIEW_SHEET);
  const manualHeaders = V2_DOCUMENT_REVIEW_HEADERS.concat(['Review Mode', 'Manual Decisions JSON']);
  v2EnsureHeaders_(reviewSheet, manualHeaders);
  v2StyleHeader_(reviewSheet, manualHeaders.length);

  v2Upsert_(V2_DOCUMENT_REVIEW_SHEET, 'Reference No', reference, {
    'Reference No': reference,
    'Student Name': application.record['Student Name'] || '',
    'Programme': application.record['Programme'] || '',
    'Review Status': status,
    'Required Documents JSON': JSON.stringify(requiredDocuments),
    'Submitted Documents JSON': JSON.stringify(submittedDocuments),
    'Missing Documents JSON': JSON.stringify(problemDocuments),
    'Outstanding Documents JSON': JSON.stringify(outstandingDocuments),
    'Reviewer Remarks': remarks,
    'Reviewed At': now,
    'Reviewed By': reviewedBy,
    'Applicant Notification Status': 'NOT_SENT',
    'Last Updated': now,
    'Review Mode': 'MANUAL',
    'Manual Decisions JSON': JSON.stringify(decisions)
  });

  const refreshedWorkflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  v2UpdateRow_(refreshedWorkflow.sheet, refreshedWorkflow.rowNumber, {
    'Document Review Status': status,
    'Document Reviewed At': now,
    'Document Reviewed By': reviewedBy,
    'Missing Document Count': problemDocuments.length,
    'Last Updated': now,
    'Updated By': reviewedBy
  });

  v2Audit_(reference, 'DOCUMENT_REVIEW', 'MANUAL_DOCUMENT_REVIEW_COMPLETED', {}, {
    status: status,
    reviewMode: 'MANUAL',
    decisions: decisions,
    problemCount: problemDocuments.length,
    outstandingCount: outstandingDocuments.length,
    outstandingDocuments: outstandingDocuments
  }, reviewedBy, 'SUCCESS', remarks);

  v2InvalidateCache_();

  let autoAiScreening = null;
  let agenticHandoff = null;
  if (status === 'COMPLETE') {
    try {
      if (typeof v2AgenticEnabled_ === 'function' && v2AgenticEnabled_()) {
        agenticHandoff = v2EmitAgentEvent_({
          referenceNo:reference,
          eventType:'DOCUMENT_COMPLETENESS_CONFIRMED',
          agentId:'ORCHESTRATOR',
          agentName:'AI Orchestrator',
          action:'ROUTE_COMPLIANCE',
          status:'QUEUED',
          fromStage:'DOCUMENT_REVIEW',
          toStage:'DOCUMENT_REVIEW',
          source:'ADMISSION_V2',
          summary:'Manual document completeness review is complete. Route applicant to Compliance & Records Agent for document-quality inspection.',
          data:{
            reviewMode:'MANUAL',
            documentReviewStatus:status,
            problemCount:problemDocuments.length,
            outstandingCount:outstandingDocuments.length
          }
        });
      }

      if (agenticHandoff && agenticHandoff.sent) {
        autoAiScreening = {
          ok:true,
          status:'HANDED_TO_N8N_COMPLIANCE',
          eventId:agenticHandoff.eventId,
          manualScreeningAvailable:true
        };
      } else {
        autoAiScreening = v2TryAutoAiScreening_(
          reference,
          agenticHandoff ? 'Manual Review Local Fallback after n8n handoff failure' : 'Manual Document Review Auto Trigger'
        );
      }
    } catch (error) {
      autoAiScreening = {
        ok: false,
        status: 'AUTO_FAILED',
        message: String(error && error.message || error),
        manualScreeningAvailable: true
      };
    }
  }

  return {
    ok: true,
    referenceNo: reference,
    reviewMode: 'MANUAL',
    status: status,
    decisions: decisions,
    problemDocuments: problemDocuments,
    problemCount: problemDocuments.length,
    outstandingDocuments: outstandingDocuments,
    outstandingCount: outstandingDocuments.length,
    nextAction: status === 'COMPLETE'
      ? (agenticHandoff && agenticHandoff.sent ? 'COMPLIANCE_DOCUMENT_QUALITY' : 'QUALIFICATION_SCREENING')
      : 'REVIEW_DOCUMENTS',
    autoAiScreening: autoAiScreening,
    agenticHandoff: agenticHandoff,
    manualScreeningAvailable: status === 'COMPLETE',
    emailSent: false,
    v1Touched: false
  };
}
