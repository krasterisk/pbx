---
phase: "18"
slug: "polnyy-refaktoring-rechevoy-analitiki"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-23"
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Charge seam → wallet | SA-CHARGE-RUN / SA-CHARGE-INSIGHTS persist amounts on sa_* only. No settleShadow or BillingBalanceService. | Calculated amount, charged=false |
| Public API token → project | Token digest binds one project. Body projectId cannot override the grant. | Upload bytes, UUID journal ids |
| Hangup dialplan → worker | Hangup stays on existing internal auth. Path and tenant come from admission, not a raw client body. | Recording path, tenant uid, duration |
| Cabinet JWT → tenant | Adapter and journal queries use vpbx_user_uid from the caller. Forged tenant args are rejected. | Project config, journal rows |
| Token secret → client | Plaintext is shown once and stored as secret_digest. Evidence and chat history must not keep the secret. | API token |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-18-01-WALLET | Tampering | sa-charge-*.ts | high | mitigate | Unit tests forbid settleShadow/BillingBalanceService; seams only write sa_* amount columns | closed |
| T-18-01-TENANT | Information Disclosure | sa_analysis_runs writes | medium | mitigate | Run updates scoped by existing vpbx_user_uid on the run row; no cross-tenant id in seam args | closed |
| T-18-01-SC | Tampering | npm installs | low | accept | No new packages; Package Legitimacy Audit empty install set | closed |
| T-18-02-IDOR | Elevation of Privilege | project Select options | high | mitigate | List projects filtered by vpbx_user_uid; reject foreign projectId on save | closed |
| T-18-02-TAMPER | Tampering | route options.analytics | medium | mitigate | Server validates project exists for tenant before dialplan reload | closed |
| T-18-02-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-03-SPOOF | Spoofing | on-hangup endpoint | high | mitigate | Keep existing internal dialplan auth; reject unauthenticated hangup | closed |
| T-18-03-PATH | Tampering | record_path wait | medium | mitigate | Path comes from admission/asset spine, not raw request body | closed |
| T-18-03-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-04-PROMPT | Tampering | score.ts LLM prompt | medium | mitigate | Bounded JSON schema scoring; evidence must reference transcript segments (existing validateResult pattern) | closed |
| T-18-04-MODEL | Spoofing | model id selection | medium | mitigate | Only platform allowlist model ids; no hidden off-list fallback (D-38) | closed |
| T-18-04-SC | Tampering | npm installs | low | accept | No new packages; port in-tree | closed |
| T-18-05-IDOR | Information Disclosure | journal.service | high | mitigate | Every query filters vpbx_user_uid + CDR access scope | closed |
| T-18-05-RBAC | Elevation of Privilege | regenerate/delete | high | mitigate | Enforce UserLevel ADMIN/SUPERADMIN server-side for destructive ops | closed |
| T-18-05-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-06-HOOK | Tampering | event-webhooks.ts | medium | mitigate | Store headers server-side only; deliver via WebhookQueueService; audit failures on webhook-failures tab | closed |
| T-18-06-INT | Elevation of Privilege | digest integration uids | high | mitigate | Resolve integrations by tenant uid; reject foreign uids | closed |
| T-18-06-SC | Tampering | npm installs | low | accept | Reuse axios via WebhookQueueService; no new install | closed |
| T-18-07-TOKEN | Spoofing | integration-credentials | high | mitigate | Hash-only secret; one-time show; project grant binds analysis (D-32) | closed |
| T-18-07-SSRF | Elevation of Privilege | url-download.ts | medium | mitigate | Intentional open URLs per D-39; enforce 50MB and timeout caps; incomplete download errors; document risk; no host allowlist | closed |
| T-18-07-OVERRIDE | Tampering | public controller project field | high | mitigate | Ignore/reject body projectId; use token grant only | closed |
| T-18-07-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-08-IDOR | Information Disclosure | dashboard.service | high | mitigate | Reuse journal/CDR access scope for all aggregates | closed |
| T-18-08-PROMPT | Tampering | insights.service | medium | mitigate | Structured insight types with evidence links; skill-bounded prompt | closed |
| T-18-08-SC | Tampering | npm installs | low | accept | Recharts already present; no new packages | closed |
| T-18-09-TENANT | Spoofing | adapter handlers | high | mitigate | UID from dispatch/JWT only (Phase 15 D-22); strip forged tenant args | closed |
| T-18-09-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-10-LEAK | Information Disclosure | UAT evidence JSON | medium | mitigate | Evidence must not embed raw audio or API token plaintext | closed |
| T-18-10-COST | Denial of Service | golden/live provider calls | low | accept | Scripts are manual/delivery-only; not in npm test | closed |
| T-18-10-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-11-IDOR | Information Disclosure | excel-export | high | mitigate | Reuse journal access scope for every export query | closed |
| T-18-11-RBAC | Elevation of Privilege | CDR Get analytics | medium | mitigate | Server enforces module entitlement + recording presence | closed |
| T-18-11-SC | Tampering | exceljs | low | accept | Already approved dependency; no new install | closed |
| T-18-12-IDOR | Elevation of Privilege | MetricEditor save | high | mitigate | APIs from 18-06 enforce tenant + publisher RBAC; UI never invents bypass | closed |
| T-18-12-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-13-SECRET | Information Disclosure | TokensTable issue dialog | high | mitigate | Show secret once; never persist into list rows or localStorage | closed |
| T-18-13-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-14-INFO | Information Disclosure | hub seed | low | accept | Removing Reports reduces surface; no new secrets | closed |
| T-18-14-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-15-TENANT | Spoofing | adapter handlers | high | mitigate | UID from dispatch/JWT only (Phase 15 D-22); strip forged tenant args | closed |
| T-18-15-SECRET | Information Disclosure | token confirm card | high | mitigate | Show secret once in card UI; exclude from chat history persistence (D-33) | closed |
| T-18-15-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-16-SPOOF | Spoofing | on-hangup | high | mitigate | Keep existing dialplan internal auth; reject unauthenticated hangup | closed |
| T-18-16-TENANT | Information disclosure | HangupAnalyticsPort | high | mitigate | resolveHangupContext enforces sameTenantProject; skip cross-tenant projectId | closed |
| T-18-16-DUP | Elevation of privilege / Tampering | enqueueAnalysisJob | medium | mitigate | knownOrigins + admission idempotency key prevents double charge | closed |
| T-18-16-SECRET | Information disclosure | SpeechAnalyticsAiAdapter | high | mitigate | Token secret once; digest-only storage; redactSecrets on chat history | closed |
| T-18-16-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-17-TENANT | Elevation of privilege | uploadBatch/analyzeUrl | high | mitigate | resolveTokenBoundProject; createRun assertScope on token project only | closed |
| T-18-17-OVERRIDE | Tampering | body.projectId | high | mitigate | Reject mismatch with project_override_forbidden | closed |
| T-18-17-SECRET | Information disclosure | integration token | high | mitigate | TenantContextGuard digest auth; never log raw token | closed |
| T-18-17-SIZE | Denial of service | upload bytes | medium | mitigate | MAX_UPLOAD_BYTES 50MB reject before persist/analyze | closed |
| T-18-17-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-18-TENANT | Information disclosure | updateInsightsRequest | high | mitigate | Patch by insightsRequestId AND tenantUid only | closed |
| T-18-18-TAMPER | Tampering | amount persistence | medium | mitigate | charged forced false; no wallet settle APIs | closed |
| T-18-18-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-19-SECRET | Information disclosure | UAT evidence / checklist | high | mitigate | Checklist: never commit plaintext token; evidence stores ids only | closed |
| T-18-19-TENANT | Information disclosure | live sample upload | medium | mitigate | Use lab tenant only; project from token grant | closed |
| T-18-19-SC | Tampering | npm installs | low | accept | No new packages | closed |
| T-18-20-01 | Tampering | edit_speech_analytics_project.apply | high | mitigate | Always merge onto getEditorState draft for ctx.vpbxUserUid; expected_revision revalidate blocks stale wipe publish | closed |
| T-18-20-02 | Information Disclosure | issue / apply logging | high | mitigate | Do not log API token secrets; secret remains apply-result only (existing D-33) | closed |
| T-18-20-03 | Elevation of Privilege | cross-tenant apply | high | mitigate | applyEditorUpdate / getEditorState keyed only by ctx.vpbxUserUid; reject foreign tenant args on propose | closed |
| T-18-20-04 | Denial of Service | N/A | low | accept | Chat confirm is human-gated; no new unauthenticated surface | closed |
| T-18-21-01 | Tampering | sa-analysis.worker.nest audioMs | high | mitigate | Never map file bytes to audioMs; prefer hangup durationSec*1000 then STT duration | closed |
| T-18-21-02 | Information Disclosure | worker logs | medium | mitigate | Log job ids / reasons only; do not log recording contents or secrets | closed |
| T-18-21-03 | Elevation of Privilege | tenantUid on job | high | mitigate | Keep tenantUid from hangup admission; updateRunCharge filters by tenant_uid | closed |
| T-18-21-04 | Repudiation | SA-CHARGE-RUN | low | accept | charged=false persist already records amount without wallet side effects | closed |
| T-18-22-01 | Elevation of Privilege | resolveTokenBoundProject | high | mitigate | Keep body project override rejection; token project only | closed |
| T-18-22-02 | Tampering | accepted background runAnalysis | medium | mitigate | Analysis only for journalIds just created under token tenant/project; no cross-tenant ids in response | closed |
| T-18-22-03 | Information Disclosure | public responses / logs | high | mitigate | Return UUID journalIds only; do not log API token secrets | closed |
| T-18-22-04 | Denial of Service | multi-file accepted | medium | mitigate | Keep sequential per-item processing; 50MB cap; fail one item without aborting batch | closed |
| T-18-22-05 | Spoofing | sync flag | low | accept | sync=true single-item wait is intentional authenticated API behavior | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

L1 check (ASVS 1): mitigate rows closed because the controls are present in the speech-analytics implementation and specs (wallet seams, token digest, project override rejection, hangup tenant check, audioMs from duration, 50MB cap). Accept rows are closed by the plan register and the log below.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-18-01-SC | T-18-01-SC | No new packages; Package Legitimacy Audit empty install set | plan register | 2026-09-23 |
| T-18-02-SC | T-18-02-SC | No new packages | plan register | 2026-09-23 |
| T-18-03-SC | T-18-03-SC | No new packages | plan register | 2026-09-23 |
| T-18-04-SC | T-18-04-SC | No new packages; port in-tree | plan register | 2026-09-23 |
| T-18-05-SC | T-18-05-SC | No new packages | plan register | 2026-09-23 |
| T-18-06-SC | T-18-06-SC | Reuse axios via WebhookQueueService; no new install | plan register | 2026-09-23 |
| T-18-07-SC | T-18-07-SC | No new packages | plan register | 2026-09-23 |
| T-18-08-SC | T-18-08-SC | Recharts already present; no new packages | plan register | 2026-09-23 |
| T-18-09-SC | T-18-09-SC | No new packages | plan register | 2026-09-23 |
| T-18-10-COST | T-18-10-COST | Scripts are manual/delivery-only; not in npm test | plan register | 2026-09-23 |
| T-18-10-SC | T-18-10-SC | No new packages | plan register | 2026-09-23 |
| T-18-11-SC | T-18-11-SC | Already approved dependency; no new install | plan register | 2026-09-23 |
| T-18-12-SC | T-18-12-SC | No new packages | plan register | 2026-09-23 |
| T-18-13-SC | T-18-13-SC | No new packages | plan register | 2026-09-23 |
| T-18-14-INFO | T-18-14-INFO | Removing Reports reduces surface; no new secrets | plan register | 2026-09-23 |
| T-18-14-SC | T-18-14-SC | No new packages | plan register | 2026-09-23 |
| T-18-15-SC | T-18-15-SC | No new packages | plan register | 2026-09-23 |
| T-18-16-SC | T-18-16-SC | No new packages | plan register | 2026-09-23 |
| T-18-17-SC | T-18-17-SC | No new packages | plan register | 2026-09-23 |
| T-18-18-SC | T-18-18-SC | No new packages | plan register | 2026-09-23 |
| T-18-19-SC | T-18-19-SC | No new packages | plan register | 2026-09-23 |
| T-18-20-04 | T-18-20-04 | Chat confirm is human-gated; no new unauthenticated surface | plan register | 2026-09-23 |
| T-18-21-04 | T-18-21-04 | charged=false persist already records amount without wallet side effects | plan register | 2026-09-23 |
| T-18-22-05 | T-18-22-05 | sync=true single-item wait is intentional authenticated API behavior | plan register | 2026-09-23 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-23 | 71 | 71 | 0 | gsd-secure-phase L1 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-23
