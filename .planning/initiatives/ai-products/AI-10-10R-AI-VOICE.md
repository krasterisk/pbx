# AI-10 10R — `/api/v1/ai-voice`

Local contract for standalone robots. Native PBX CDR/queue_log install stays gated on DB-04 I4. Live robots-only installer smoke stays gated on I1–I3.

JWT routes are registered on both `/api/ai-voice` and `/api/v1/ai-voice`. Integration keys use `Authorization: Bearer krint_v1_<selector>_<secret>`; tenant admin uses a user JWT.

## First run (no analytics entitlement)

1. Provider + prompt on the agent (existing AI-07 draft/publish)
2. Browser test deployment: `POST /api/v1/ai-voice/deployments` with `kind=browser_test`, then `PUT .../ready`
3. SIP profile: `POST /api/v1/ai-voice/sip-connections`
   - `udp`/`tcp` stay `draft` (`ready: false`) until certified
   - `tls` / SRTP without lab evidence: `status=disabled`, `reason=sip_profile_unsupported`
   - native PBX without I4 evidence: `native_pbx_gated`
4. Publish: `POST /api/v1/ai-voice/agents/{uid}/publish`
5. Drain: `POST /api/v1/ai-voice/drain` marks the tenant's `ready` deployments `draining`. New admissions return `admissions_stopped`; in-flight sessions are not deleted.

External SIP deployments still start `disabled` (`external_sip_disabled` if forced ready). `liveMcp=true` is not declared here. TLS/SRTP/NAT certification remains a separate evidence gate.

## curl

```bash
curl -sS "$API/api/v1/ai-voice/capabilities" \
  -H "Authorization: Bearer $JWT"

curl -sS -X POST "$API/api/v1/ai-voice/deployments" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"agentUid":9,"kind":"browser_test","versionId":"'"$VERSION_ID"'"}'

curl -sS -X PUT "$API/api/v1/ai-voice/deployments/$DEPLOYMENT_ID/ready" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"ready":true}'

curl -sS -X POST "$API/api/v1/ai-voice/sip-connections" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"name":"edge","transport":"udp"}'

curl -sS -X POST "$API/api/v1/ai-voice/sip-connections" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"name":"tls-lab","transport":"tls"}'

curl -sS -X POST "$API/api/v1/ai-voice/agents/9/publish" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"operationKey":"pub-1"}'

curl -sS -X POST "$API/api/v1/ai-voice/drain" \
  -H "Authorization: Bearer $JWT"
```
