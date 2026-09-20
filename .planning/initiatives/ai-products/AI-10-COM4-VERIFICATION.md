# AI-10 COM4 verification — 2026-09-20

Status: **implemented locally; I1 installer not this slice**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`.

## Passed

- Preflight script `harness/database/commercial-preflight.cjs` **2/2**.
- Commercial `StandaloneAiCoreModule.forProfile` still throws when `DB_SCHEMA_PROFILE` does not match.
- Community source boundary and composition tests already exist (`test:community:composition`, `test:community:source-boundary`).
- Publisher private key on a customer env fails closed. Customer `CC_AI_KEY_SECRET` is required outside development.
- MIT license files were not rewritten.

## Deviations / not this slice

- No public distro manifest / SPDX decision.
- No I1 installer, I2 backup keys, I3 upgrade. 10A/10R remain gated.
