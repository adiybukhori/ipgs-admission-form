# IPGS Admission V2 — AI Screening Pilot Plan

## Objective
Validate the AI screening layer before any production decision support is enabled.

## Pilot scope
- Use 10–20 applications covering a mix of programmes, qualification fields, CGPA/grade formats, and CV quality.
- GPT Work is the pilot provider.
- AI output is stored in `V2_AI_SCREENING` using schema version `1.0`.
- AI never changes workflow stage and never makes the final admission decision.
- Registry confirms the extracted/classified values before the formal qualification rule engine runs.

## Metrics
1. JSON/schema validity: target 100%.
2. Qualification extraction accuracy: target >= 98%.
3. Institution extraction accuracy: target >= 98%.
4. CGPA/grade extraction accuracy: target >= 99% where clearly present.
5. Field-of-study extraction accuracy: target >= 98%.
6. Relevant work-experience agreement with Registry: target >= 90%.
7. Field-classification agreement with Registry: target >= 90%.
8. Critical hallucination rate: target 0%.
9. Correct ambiguity/flagging rate: target >= 95% for unclear or contradictory documents.
10. Human override rate: monitor by reason and programme.

## Pilot pass criteria
The pilot may proceed to OpenAI API production integration when:
- No critical hallucination is found in the final validation batch.
- Extraction metrics meet the targets above.
- Human reviewers report that evidence/flags are understandable and traceable.
- Provider output remains valid against the same schema across the test set.
- The formal rule engine still receives only human-confirmed values.

## Migration rule
The provider adapter may change from `WORK` to `OPENAI`, but the following must remain unchanged:
- `V2_AI_SCREENING` schema
- Admin Command Center display contract
- Human confirmation gate
- Qualification rule engine
- SAC workflow
- Audit logic

## Rollback
If the provider output becomes unreliable:
- Set AI provider usage to disabled.
- Continue manual Registry field/work-experience confirmation.
- The rule engine and admission workflow continue operating without AI.
