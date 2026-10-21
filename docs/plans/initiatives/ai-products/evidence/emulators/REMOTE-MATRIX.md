# Paid-SIP emulator, shared nomic vector, emulated wallet

Local units 2026-09-20. No PSTN egress. No `BillingBalanceService.charge`.

## Paid SIP (`createPstnEmulator`)

Lab numbers only: `+15555550xxx`. Real-looking `+79…` → `pstn_not_emulated`.

Jest `pstn-emulator.spec.ts`:

- INVITE lab DID → 200, pulse 100 kopecks on **emulated** wallet
- wrong auth → 403
- CPS > 2 → 429
- budget &lt; pulse → 402
- TLS/SRTP certified **on the emulator profile** (in-process, not Asterisk `transport-tls`)
- NAT loss counter at 10% of 20 packets = 2
- drain `{ liveSip: false, emulatedPstn: true }`

## Vector index (reuse voice-robots nomic)

`SemanticRouterService` now loads `getSharedNomicEmbedder()` (`nomic-ai/nomic-embed-text-v1.5`, dim 256). Knowledge retrieval uses the same cosine/normalize/blob helpers in `modules/embeddings/nomic-embed.ts` so analytics/robot compositions do **not** import `voice-robots/` (source-boundary).

CI portable index: `hashed_bow_256` (same dim, token-hash). TOOL6 recall@5 ≥ 0.85; unanswerable empty; tenant 9 chunk excluded. ONNX nomic is used when the model is present; tests do not download it.

## Wallet emulator

`createEmulatedWallet` / `settleEmulatedWallet`: integer kopecks, UNIQUE operation key replay, `liveBilling: false`. Passing the D4 `disabledWallet` probe throws `live_wallet_denied`. Shadow `cloud_wallet` path remains disabled (`assertCloudWalletDisabled`).

Jest: `emulated-wallet.spec.ts` 2 units × 1.25 → 2.50 / 250 kopecks, replay does not double-debit.
