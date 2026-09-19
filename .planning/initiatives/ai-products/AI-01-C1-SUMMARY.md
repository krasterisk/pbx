# AI-01-C1 — neutral AI connectivity

Status: implementation complete on 2026-09-19 under [AI-01-C](AI-01-C-COMPOSITION-UI-PLAN.md), task C1, revision SHA-256 `5A572628DC01B7B716E285773BAA46BD5ED3FA0276D7F9B64329F922E83C00F4`.

The shared provider model, DTO, service, endpoint normalization and encryption live in `AiConnectivityModule`. Existing `ai-agents` paths remain re-export facades, preserving the table, UIDs, routes and consumers. AI-chat and voicemail import connectivity directly, without loading robot management just to resolve a provider. Provider CRUD responses now have explicit public fields, while the internal resolver rechecks tenant, enabled state and capability immediately before model I/O. The chat operation carries provider identity instead of ciphertext; voicemail uses the same resolver.

New ciphertext has a versioned AES-GCM envelope and key ID. Existing unversioned ciphertext remains readable with its configured legacy key; startup never rewrites records. Production writes without a configured installation secret fail closed. See the [operational contract](AI-01-C1-CONNECTIVITY-CONTRACT.md) for env settings and rotation boundaries.

This is a connectivity foundation, not standalone AI robots or analytics. The independent product composition, provider UI, durable revisions/jobs and actual voice/analytics runtimes remain later tasks.
