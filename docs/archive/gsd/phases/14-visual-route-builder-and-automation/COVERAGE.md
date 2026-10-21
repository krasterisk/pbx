# API Coverage — Phase 14 Visual Route Builder and Automation

**Written:** 2026-09-04  
**Surfaces:** first-party NestJS HTTP only (`/route-references`, `/dialplan/dry-run`, `/route-templates`, `/callback-requests`, `/internal/callback-requests/enqueue`)  
**Default:** no new third-party API. Every OPT-OUT below is a vendor/SDK this phase does **not** add.

**Not rows:** JWT tenant APIs listed above, `RouteApplyService` / Asterisk reload (in-process), `react-to-print` (browser print, no network). AMI `krsk-click-to-call` for callback originate reuses the existing Phase 9/7 originate path — no new AMI verb or vendor SDK.

No new npm packages for HTTP clients. Scanner originate stays on in-repo AMI, not a SaaS callback provider.

---

## External / vendor APIs

| Capability | Disposition | Reason |
|------------|-------------|--------|
| Third-party graph/layout API (reactflow cloud, elk service) | OPT-OUT | D-52: CSS-grid + in-repo `react-to-print` |
| PDF export SaaS / html2canvas / jspdf | OPT-OUT | D-52: browser print only |
| External dry-run / call-simulation SaaS | OPT-OUT | Walker is in-process `walkDialplanGraph` |
| External template marketplace API | OPT-OUT | Built-in seed + tenant CRUD in Nest |
| Twilio / vendor callback API | OPT-OUT | Enqueue + `@Interval` scanner + existing AMI originate |
| New OpenAI / LLM HTTP in this phase | OPT-OUT | Dry-run and template AI adapters expose DomainAiAdapter tools; no new chat-completions client (Phase 13/15) |
| New STT / TTS vendor | OPT-OUT | Out of phase scope |
| Official `openai` / LangChain / LangGraph SDK | OPT-OUT | No new packages; Phase 15 owns the agent loop |

---

## First-party HTTP (not third-party — recorded so the detector is not silent)

These are Nest controllers we shipped. They are INTEGRATE as product surface, not as vendor coverage:

| Endpoint family | Disposition | Reason |
|-----------------|-------------|--------|
| `GET /route-references/:kind/:uid` (+ IVR usage) | INTEGRATE | D-48 index; JWT tenant only |
| `POST /dialplan/dry-run` | INTEGRATE | D-29…D-32; draft walk |
| `/route-templates` CRUD + apply | INTEGRATE | D-33…D-37 |
| `/callback-requests` list/claim/cancel + `/internal/.../enqueue` | INTEGRATE | D-38…D-42; enqueue uses dialplan bridge token like voicemail ingest |
