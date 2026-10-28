# A13 — 150 real calls, six tabs, SSE versus WebSocket

Coordinator: `/root`, codex-direct. Stand: `192.168.2.201:3010`. User authorised actual internal calls and six isolated Playwright tabs on the stand. No personal browser tabs participated in the final comparison.

## Reproducible common baseline

Frontend `208e0b23a22abbba0fbc6cb6fc8e74767849e2f4`, backend `12ac91ce348a0d31f6de8a1ae08c46190500904d`. Both transports use the same application, fixtures, call set, six freshly created Chromium targets, 60-second warmup, telemetry, and browser health probes every 30 seconds per tab. Normal windows: 120 seconds, one real SIP hold/unhold cycle per second. Stress: 60 seconds, ten cycles per second, 40ms hold interval. No profiler during measurement.

Actual media: 150 simultaneous PJSIP dialogs, 450 Asterisk channels (two Local legs and one PJSIP leg per connection), bidirectional PCMU RTP. Private Asterisk/SIP fixtures have no external trunks. Separate seeded history contains 12,000 synthetic records; those records are not claimed as real call evidence. Cabinet5 contains 200 operators and 12 queues on the owned DB clone; original stand database retained.

The stand has four CPU cores. Chromium, Asterisk and the SIP generator run on that same host. Browser budget: three cores, 6GiB, swap disabled. CPU percentages below use **100%=one core**, except total host utilisation.

All six headless pages reported `document.visibilityState=visible`. This measures six concurrently rendered panels; it does not measure the browser's background throttling of five hidden desktop tabs. The measured host ceiling includes the load generator and browser, not just the application server. A production capacity claim needs a separate browser/load host and an agreed latency/error SLO.

| Common-baseline metric | SSE normal | WS normal | SSE stress | WS stress |
|---|---:|---:|---:|---:|
| Source → received event p95, ms | 7,918 | 14,731 | 1,316 | 3,895 |
| Source → observed DOM change p50 / p95, ms | 131 / 345 | 138 / 437 | 606 / 2,236 | 1,736 / 4,989 |
| Observed DOM transitions / received transitions across six pages | 1,234 / 1,404 | 1,124 / 1,416 | 352 / 6,750 | 280 / 6,726 |
| Fully completed health probes / total | 0 / 24 | 19 / 24 | 0 / 14 | 9 / 12 |
| Health abort/read errors | 24 | 5 | 14 | 3 |
| HTTP requests started in browser | 24 | 48 | 13 | 23 |
| HTTP requests reaching proxy | 10 | 50 | 2 | 24 |
| HTTP 429 / 502 at proxy | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Proxy upstream error counter | 0 | 2 | 0 | 0 |
| Backend mean CPU / peak RAM MiB | 14.08% / 250.5 | 19.19% / 225.0 | 11.06% / 251.5 | 12.28% / 253.9 |
| Browser mean CPU / peak RAM MiB | 127.13% / 2,661 | 123.26% / 2,580 | 133.17% / 2,361 | 126.16% / 2,316 |
| Mean total host CPU | 79.15% | 84.59% | 99.94% | 99.93% |

The observed DOM percentile is **not** a whole-event delivery SLO: fast state reversals can coalesce before a render, and event receipt has substantial long tails. Source-to-receipt, coverage and DOM delay must be read together. Next-animation-frame timestamps are not physical paint measurements. Header200 followed by an aborted body counts as a failed probe.

Proxy counter boundaries also include in-flight responses from preparation and other application namespaces, so their counts need not equal browser-started requests. SSE normal recorded one HTTP401 at the proxy, without a corresponding completed measured health request; its cause is not established. WS normal's two upstream errors coexist with client aborts; they are not proof of a backend crash. All raw counters are retained. HTTP/2 SSE was not tested; the transport conclusion applies to the measured HTTP/1.1 deployment.

SSE over this stand's HTTP/1.1 origin occupies the browser's six connection slots. Ordinary HTTP requests wait behind those streams; all health probes failed despite no429. WS normal retained six CC connections without in-window reconnects and allowed ordinary HTTP. Extra service-dashboard WebSockets are classified separately from the six CC streams. The stress capture had two pages with one stale HOLD row although the latest wire status was TALKING. Raw baseline is retained unchanged; this is a failed consistency gate, not a lost SIP event or accepted capacity result.

## Selected scheme and follow-up

Use authenticated WebSocket for call-center events, one source per Redux store, fresh server snapshot after reconnect, bounded reconnect backoff. Backend suppresses unchanged agent and queue wire payloads; actual changes remain ordered and immediate. Incoming incremental actions coalesce subscriber notifications on a bounded16ms timer, independent of background-tab animation frames. Manual controls retain synchronous priority. Visible timers and memoized rows avoid rebuilding the entire operator table for every call event. No application rate limit was raised.

Post-comparison causal control under150real dialogs: each of two ordinary queue reconciles emitted24queueUpdate messages, all24identical. Queue-payload dedupe is implemented in `530f634a`; targeted33tests and full backend520suites/5105tests passed. Both post-fix reconciles returned201 and emitted **zero** duplicate queue messages, with snapshots still containing200agents/12queues/150calls. This proves suppression of redundant messages; two reconcile timings are not a general API performance benchmark.

The separately labelled follow-up uses frontend208e/backend530f, same media generator and six-page budget, with normal120s/stress60s. It is not substituted for either side of the common-baseline comparison.

| Selected WS after queue dedupe | Normal | Stress |
|---|---:|---:|
| Source → received event p50 / p95, ms | 9 / 4,557 | 924 / 11,333 |
| Source → observed DOM p50 / p95, ms | 130 / 322 | 696 / 6,370 |
| Source → observed DOM p99, ms | 2,437 | 15,939 |
| Observed DOM / received transitions, six pages | 1,280 / 1,398 | 388 / 6,846 |
| Fully completed health probes / total | 24 / 25 | 10 / 13 |
| Health abort/read errors | 1 | 3 |
| Successful health p95, ms | 135 | 2,964 |
| Browser requests / proxy requests | 49 / 51 | 22 / 23 |
| Proxy upstream error counter | 1 | 2 |
| HTTP 429 / 502 | 0 / 0 | 0 / 0 |
| Backend mean CPU / peak RAM MiB | 15.15% / 239.9 | 30.66% / 222.3 |
| Browser mean CPU / peak RAM MiB | 126.08% / 2,604 | 147.49% / 2,465 |
| Mean total host CPU | 79.86% | 97.58% |
| Six CC connections stable / all final tables agree | pass / pass | pass / pass |

Every page received all233normal and1,141stress source transitions. Short states coalesce before rendering; final rows are all150TALKING on all six pages. Both windows retained6→6CC streams with no reconnect, fresh DOM and wire/DOM consistency. This is live verification of delivery and final convergence, **not acceptance of a zero-error or bounded-latency capacity SLO**: one normal and three stress probes failed, and stress receipt/DOM tails remain long. The PLAN engineering gates **p95<=250ms and p99<=500ms fail in both final windows**. Stress p95 worsened in this follow-up despite fewer redundant queue messages. Do not claim universal speedup or select a transport using DOM percentiles alone. WS is chosen because it preserves ordinary HTTP access under the measured six-tab HTTP/1.1 constraint; the current collocated four-core stand still needs resource separation and further profiling to certify strict150-call performance.

## Evidence and verification

Immutable baseline archive: `public-evidence-20261028T113321Z.tar.gz`, SHA256 `fa9739e7fbf97292efcf994c6f9135499f427e8087696bd20fb6161a2d12ada5`, 1,537,265 bytes. Locator through `tools/artifacts/paths.cjs`: `runs/supervisor-pulse/a13-publish-stand-benchmark-20261028/paired-evidence-208e/`. It contains actual AMI/media proof, per-window telemetry, browser receipts and network counters. Private credentials, dumps, auth tokens and traces are excluded from public exports and Git.

Commands: `npm run test:backend` (520 suites/5105pass,27skipped; existing worker force-exit warning), `npm run lint` (0errors,127backend/101frontend existing warnings), frontend `tsc -b` and92targeted frontend tests passed for208e. Default `npm run test:frontend` remains blocked at Vite/esbuild config loading with Windows EACCES; it is not reported as a full frontend pass. Harness namespace-gate Python tests:4pass. Stand uses direct Node, not a source watcher; baseline backend/web restartCount0 and noOOM.

Backend530f Linux TypeScript build passed57.1s, image manifest `9f2519ea53ff3c95cf07973160a47ba42edc1c8e0db48d6e104e2b4b5afdf9c7`. Guarded deployment at11:57UTC retained12ac as `krasterisk-chat-r29-backend-pre-queue-dedupe`; health4.7.1.3/schema0055/SHA530f passed. Local backend also returned200/SHA530f and its compiled service contains queue dedupe.

Ordinary frontend build passed139.7s with `VITE_CC_BENCHMARK=false`; image manifest `47e3ad24c352554998444f23c2b0fdf07fd9f67549ace8136cc0a8ccb2f4166e`. Published at12:09UTC, main asset `/assets/main-21Pqe5EO.js`, SHA256 `7c4dc8496d14287e428308590c0131c0b0c6366a43e4e1ede6a1b0d6df3c85df`. Served bytes equal built bytes; measurement marker absent. Source208e remains frontend-equivalent to530f.

Final normal authenticated snapshot:200agents/12queues/**0calls**, health200. Asterisk0activechannels/SIP0dialogs, owned Chromium exited0, backend/web/media restartCount0 and noOOM. Seeded cabinet and idle isolated telephony fixtures retained for use; previous containers/DB retained for rollback. No production calls or personal browser targets touched. Required full frontend loader gate remains an explicit environment limitation; no independent review claimed.

Final selected-WS evidence: `public-evidence-20261028T121143Z.tar.gz`, SHA256 `37490c6322b46b08afc4582dd0f4b3b57e11b36bfffba3b38bbb44ff4515fafe`,832,832bytes. Artifact-helper locator `runs/supervisor-pulse/a13-publish-stand-benchmark-20261028/selected-ws-evidence-530f/`. Includes both phase results, AMI/media/CPU/RAM proof, pre/post duplicate controls, deployment identity, ordinary publication and final cleanup checks. Archive transfer/hash verification is part of final receipt.

Disposition: requested source publication, stand update/fixtures, common-baseline comparison, selected local implementation and separate live rerun are implemented/released to test stand. Six-stream delivery and final table convergence passed. Strict zero-error150-call capacity remains **not accepted**, for the measured latency/error reasons above; next technical investigation is resource-separated performance profiling, not an unmeasured switch back to SSE. No unrelated initiative or historical acceptance gate is closed by this result.
