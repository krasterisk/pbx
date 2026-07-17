/**
 * Dual SIP + WebRTC companion — no schema change required.
 *
 * `webrtc_enabled` is derived from the existence of companion endpoint
 * `ew{ext}_{tenant}` (ps_endpoints row size is already at MySQL limits,
 * so we avoid adding a column).
 *
 * This script is a no-op kept for discoverability / docs.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/endpoints/migrate-endpoints-webrtc-companion.ts
 */
async function main() {
  console.log(
    '[migration] No DDL needed: WebRTC companion is detected by presence of ew* endpoint id.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
