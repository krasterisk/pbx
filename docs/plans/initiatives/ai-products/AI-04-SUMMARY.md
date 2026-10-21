# AI-04 SUMMARY — external speech analytics vertical slice

Phase: AI-04 AN1–AN6. Technical pilot only. Commercial launch, metric editor (AI-05), dashboards (AI-06), native route analysis (AI-06P) and wallet charge (AI-10) are out of scope.

## Delivered

- Additive `0011-speech-analytics.sql` and `0012-ai-webhooks.sql`.
- Projects, draft If-Match, publish CAS, project resource resolver (B2 grant gate).
- Public `/api/v1/speech-analytics` and JWT `/api/speech-analytics` share one domain service.
- Upload → complete → initial analysis-run admission in one SQL transaction via `AiJobAdmissionService.admit(..., transaction)`.
- Business key tenant+principal+project+externalCallId+sourcePart; same checksum replays, different hash 409.
- Fixed rubric v1: greeting_present, next_step_agreed, topic. Silence is unscorable, not a fake fail score.
- Webhook HMAC (timestamp + '.' + body), 5 minute window, HTTPS SSRF deny.
- Hub FSD `features/speechAnalytics` + projects/recordings pages; optimistic intake Switch.

## Not claimed

- Consented 30-call RU holdout / provider WER sheet (commercial accuracy).
- Live wallet charge. Shadow/local_byok unchanged.
