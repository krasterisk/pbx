# AI-10 10R — `/api/v1/ai-voice`

Local contract for standalone robots. **Robots-only installs do not wait for I4.** Native PBX CDR/`queue_log` claims do. Live disposable-API match uses DB-04 I1 `robot-api`.

JWT routes are registered on both `/api/ai-voice` and `/api/v1/ai-voice`. Integration keys use `Authorization: Bearer krint_v1_<selector>_<secret>`; tenant admin uses a user JWT. Query `?token=` is rejected. Client-supplied `tenantUid` in the body is rejected.

## First run (no analytics entitlement)

1. Provider + prompt on the agent (cascade LLM/STT/TTS profiles)
2. Publish a version (JWT): `POST /api/v1/ai-voice/agents/{uid}/publish`
3. Browser test deployment: `POST /api/v1/ai-voice/deployments` with `kind=browser_test` and `versionId`, then `PUT .../ready`
4. SIP profile: `POST /api/v1/ai-voice/sip-connections`
   - `udp`/`tcp` stay `draft` (`ready: false`) until certified
   - `tls` / SRTP without lab evidence: `status=disabled`, `reason=sip_profile_unsupported`
   - native PBX without I4 evidence: `native_pbx_gated`
5. Drain: `POST /api/v1/ai-voice/drain` marks the tenant's `ready` deployments `draining`. New admissions return `admissions_stopped`; in-flight sessions are not deleted.

External SIP deployments still start `disabled` (`external_sip_disabled` if forced ready). `liveMcp=true` is not declared here. TLS/SRTP/NAT certification remains a separate evidence gate.

## curl

```bash
curl -sS "$API/api/v1/ai-voice/capabilities" \
  -H "Authorization: Bearer $JWT"

curl -sS -X POST "$API/api/v1/ai-voice/agents/$AGENT_UID/publish" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"operationKey":"pub-1"}'

curl -sS -X POST "$API/api/v1/ai-voice/deployments" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"agentUid":'"$AGENT_UID"',"kind":"browser_test","versionId":"'"$VERSION_ID"'"}'

curl -sS -X PUT "$API/api/v1/ai-voice/deployments/$DEPLOYMENT_ID/ready" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"ready":true}'

curl -sS -X POST "$API/api/v1/ai-voice/sip-connections" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"name":"edge","transport":"udp"}'

curl -sS -X POST "$API/api/v1/ai-voice/sip-connections" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"name":"tls-lab","transport":"tls"}'

curl -sS -X POST "$API/api/v1/ai-voice/drain" \
  -H "Authorization: Bearer $JWT"
```

OpenAPI tag: `AI Voice` at `/api/docs`.
