# Open gates 1–5 — VERIFICATION

| Check | Result |
|---|---|
| SDES INVITE on `127.0.0.1:15061` | 401 → 200, `answerCrypto: true` |
| SRTP media decrypt | not measured — **BLOCKED** |
| NAT | loopback only — **BLOCKED** |
| MET5 corpus | absent — **BLOCKED** |
| GPU / ollama / whisper | absent — **BLOCKED** |
| MCP vendor env | absent — **BLOCKED** |
| Pilot HTTP default | `not-installed` |
| Pilot HTTP `pilot=1` | `installed`, `usable: true`, `pilot: true` |
| Active channels after probe | 0 |

Matrix: [evidence/open-gates-1-5/REMOTE-MATRIX.md](evidence/open-gates-1-5/REMOTE-MATRIX.md).
