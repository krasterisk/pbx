# Callcenter stand and transport benchmark

This harness targets the explicitly selected disposable test stand. Real calls
are restricted to the newly owned A13 Asterisk, fixed internal contexts and
receipt-validated test queues. There are no external trunks or dial routes.
Synthetic history must be labeled separately from real SIP/RTP measurements.

`stand-web.cjs` serves a built frontend and forwards streaming `/api/` responses
and `/socket.io/` WebSocket upgrades to the backend. It preserves application
authentication and supplies no test-control or credential endpoint. Inputs:
`WEB_ROOT`, `BACKEND_HOST`, `BACKEND_PORT`, `PORT`. Defaults match the isolated
stand containers. JSON stdout counters contain counts only, never request
payloads, tokens or telephone data. Do not use these counters as proof of browser
render latency; that is measured separately by the table benchmark.

Check with `node --test harness/callcenter/stand-web.test.cjs`.
Raw results, captures, database backups and credentials belong in the external
`ARTIFACTS_ROOT` resolved by `tools/artifacts/paths.cjs`, never this directory.

`seed-stand.cjs` requires NODE_ENV=test, the exact owned clone database and a
fresh absolute private receipt path. It creates an isolated tenant, 200 operator
profiles without web passwords, 12 queues, a supervisor and synthetic history.
`prepare-asterisk.py` validates that receipt and creates fresh private config,
AMI credentials and PCMU media for a separate Asterisk container. No public
container ports are needed. `sip-autoanswer.py` supplies bounded SIP dialogs and
bidirectional PCMU RTP; its hold/unhold control is a private filesystem socket.
`run-real-calls.py` originates 150 internal queue calls, records actual AMI channel
inventories and events, and hangs up only its owned calls on signal/deadline.
`run-phase.py` requires all 150 dialogs to have received and sent RTP, then runs
the same hold/unhold schedule and container CPU/RAM telemetry for both transports.
Keep the generator running across both phases; never compare different call sets.

Frontend measurement is enabled only by VITE_CC_BENCHMARK=true in a dedicated
build. The query ccTransport=sse selects the retained SSE endpoint; otherwise
WebSocket is used. Both feed identical application handlers and tables. The
hidden DOM receipt contains synthetic call IDs/statuses and timing only; it has
no JWT, names or numbers. DOM commit and next animation frame are distinct from
visible paint, especially in background tabs. Correlate with real timestamped
AMI Hold/Unhold events after clock calibration; transport receipt alone is not
table-render evidence. Restore the ordinary build after measurement.

Additional checks: `python -B -m unittest discover -s harness/callcenter -p
'test_*.py'`; frontend callCenterBenchmark/callCenterEventSource tests.

The user explicitly authorized the later headless Playwright run on the stand
after the desktop browser became slow and its approval/control channel timed out.
`browser-load.cjs` runs a separate Chromium with six real pages and ordinary UI
login to the owned cabinet. It records sanitized HTTP metadata, actual DOM rows,
the opt-in browser timing receipt and screenshots; it never exports auth storage,
request bodies, tokens or WebSocket payloads. `coordinate-stand.py` coordinates
through a private mounted directory, requires all six 150-row tables, warms each
phase for60seconds, keeps the exact same real SIP dialogs across all four phases,
captures proxy/host/container metrics and stops the owned generator at the end.
No Docker socket is exposed to the browser container. Keep its CPU/RAM budget and
Chromium version identical between transports. A desktop attempt that lost browser
connections is diagnostic evidence, not an accepted six-tab comparison.

Prepare the six pages sequentially and poll readiness on a timer: the first
parallel cold run produced Chromium ERR_CACHE_WRITE_FAILURE for five copies of
the main module, while frame-based readiness could time out on an already
populated table. Pages now push their actual DOM rows and the opt-in timing
receipt over a private Playwright binding. The driver polls cached receipts,
never application auth storage. This avoids repeated synchronous DOM reads
which also stalled the measurement start. Receipts must be fresh and match
the selected transport; these failed
preparations are preserved separately, outside measured windows. A preparation
CPU-profile experiment stalled after all six tables were ready, so accepted
runs collect CPU externally and launch the full Chromium headless channel,
not the separate headless shell. Every test document also starts one public
`/api/health` read per page every5seconds with a
5second browser AbortController deadline, identically for both transports. This
tests ordinary HTTP availability in the same browser connection pool without
reading auth storage. `analyze-run.py --directory <external-run> --output
<external-summary.json>` correlates AMI agent-channel events through AgentConnect
to actual caller IDs, and reports per-page receipt/DOM/next-frame distributions,
container/host resources, API availability and proxy errors. Coalesced transient
states and unreceived events must be distinguished; do not label next-frame
timestamps as physical paint. Latency analysis excludes identical1s start/3s
end margins to avoid the2s receipt publication boundary, and counts the first
receipt/DOM per AMI transition rather than repeated same-status refreshes.
