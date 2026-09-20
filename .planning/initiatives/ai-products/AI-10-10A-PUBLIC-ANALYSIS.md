# AI-10 10A — public analysis onboarding

Local contract for standalone analytics. Live disposable-API match and self-hosted installer smoke use DB-04 I1 `analytics-api` (I2/I3 available for restore/upgrade). **Analytics-only installs do not wait for I4.** Native PBX CDR/`queue_log` claims do.

## Auth

- Tenant admin JWT: `Authorization: Bearer <jwt>`
- Integration key (shown once): `Authorization: Bearer krint_v1_<selector>_<secret>`
- Query `?token=` is rejected. Client-supplied `tenantUid` in the body is rejected.

## First run (no PBX / AMI / ARI)

1. Create a project (JWT): `POST /api/speech-analytics/projects`
2. Publish it (JWT): `POST /api/speech-analytics/projects/{id}/publish`
3. Create a key (JWT, token once): `POST /api/v1/integrations`
4. Grant `analytics:upload` and `analytics:read` on that project: `PUT /api/v1/integrations/{id}/grants`
5. Upload a sample (integration key): `POST /api/v1/speech-analytics/uploads` → `PUT .../content` → `POST .../complete`
6. Analyze: `POST /api/v1/speech-analytics/analysis-runs` with `Idempotency-Key` and `externalCallId`
7. Read `GET /api/v1/speech-analytics/analysis-runs/{id}/result`

Rotate the key with `POST /api/v1/integrations/{id}/rotate`. The new token is returned once; a replay of the same `operationId` returns `token: null`.

Export does not widen ACL. Retention hold, foreign tenant, and missing scope fail closed and leave a receipt in the onboarding engine.

CI keeps COM2 `cloud_wallet` off (`analyticsCiUsesShadow()`).

## curl

```bash
curl -sS "$API/api/v1/speech-analytics/capabilities" \
  -H "Authorization: Bearer $KRINT"

curl -sS -X POST "$API/api/speech-analytics/projects" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"name":"Pilot"}'

curl -sS -X POST "$API/api/speech-analytics/projects/$PROJECT_ID/publish" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"operationKey":"'"$OPERATION_KEY"'"}'

curl -sS -X POST "$API/api/v1/integrations" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"label":"ingest","product":"speech_analytics","operationId":"11111111-1111-4111-8111-111111111111"}'

curl -sS -X PUT "$API/api/v1/integrations/$KEY_ID/grants" \
  -H "Authorization: Bearer $JWT" -H "content-type: application/json" \
  -d '{"expectedRevision":"1","grants":[{"resourceKind":"project","resourceId":"'"$PROJECT_ID"'","scope":"analytics:upload"},{"resourceKind":"project","resourceId":"'"$PROJECT_ID"'","scope":"analytics:read"}]}'

curl -sS -X POST "$API/api/v1/speech-analytics/uploads" \
  -H "Authorization: Bearer $KRINT" -H "content-type: application/json" \
  -d '{"projectId":"'"$PROJECT_ID"'","expectedBytes":64}'

curl -sS -X PUT "$API/api/v1/speech-analytics/uploads/$UPLOAD_ID/content" \
  -H "Authorization: Bearer $KRINT" -H "content-type: application/json" \
  -d '{"bytesBase64":"UklGRg=="}'

curl -sS -X POST "$API/api/v1/speech-analytics/uploads/$UPLOAD_ID/complete" \
  -H "Authorization: Bearer $KRINT" -H "content-type: application/json" \
  -d '{}'

curl -sS -X POST "$API/api/v1/speech-analytics/analysis-runs" \
  -H "Authorization: Bearer $KRINT" -H "Idempotency-Key: run-1" \
  -H "content-type: application/json" \
  -d '{"projectId":"'"$PROJECT_ID"'","assetId":"'"$ASSET_ID"'","externalCallId":"ext-1"}'

curl -sS "$API/api/v1/speech-analytics/analysis-runs/$RUN_ID/result" \
  -H "Authorization: Bearer $KRINT"
```

OpenAPI tag: `Speech Analytics Public` at `/api/docs`. Broader integration tag: `AI Integrations`.
