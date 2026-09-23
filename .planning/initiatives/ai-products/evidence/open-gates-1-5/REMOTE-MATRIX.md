# Open gates 1–5 — 2026-09-20

Host: `root@ipbx.krasterisk.ru`. No live Adaptive DSN overwrite. No autodial / `xray-ui`. No live tenant debit. No commercial launch. Nest was **not** pointed at the production database.

## Verdict table

| # | Gate | Verdict | Evidence |
|---|---|---|---|
| 1a | Lab SDES offer/answer | **PASS** | TLS INVITE `sip-echo` → 401 then **200**; answer contains `a=crypto` — [srtp-offer.json](srtp-offer.json). `res_srtp.so` Running. |
| 1b | SRTP decrypted media | **BLOCKED** | No RTP packets decrypted. `srtpMediaDecrypted: false`. |
| 1c | NAT traversal | **BLOCKED** | Loopback only (`received=127.0.0.1`). No second host / public mapping test. |
| 2 | MET5 30-call holdout | **BLOCKED** | No dual-human corpus in repo or on ipbx. Synthetic fixtures must not close MET5. |
| 3 | Local-AI STT | **BLOCKED** | No `nvidia-smi`, no `ollama`, no whisper binary on ipbx. |
| 4 | `liveMcp=true` | **BLOCKED** | No MCP/OpenAI/Anthropic env on ipbx. TOOL6 remains fake MCP. |
| 5 | Pilot health HTTP | **PASS** (contract) | Loopback `:18080`: default `not-installed`; `pilot=1` → `installed` / `pilot: true` — [pilot-http.json](pilot-http.json). Full Nest/Sequelize boot against production DB was refused. `liveDebit: false`. |

## Lab notes

- Digest-authenticated INVITE uses disposable endpoint `ai-lab-tls` on `127.0.0.1:15061`.
- A misplaced `srtpcheck` extension inserted outside `[krasterisk-ai-lab]` was removed. Existing `sip-echo` answered the probe.
- Production UDP `:5060` / WSS untouched. Channels after probe: 0 active.
