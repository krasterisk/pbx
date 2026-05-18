# CDR: migration from `cdr_clean` trigger to v4 GROUP BY

## Background

Legacy v3 used MySQL trigger `bi_cdrEvents` on `cdr` to copy/dedupe rows into `cdr_clean` (one row per call).

v4 reads `cdr` directly with `GROUP BY linkedid` in application SQL.

## Rollout steps

1. Deploy v4 backend with `ReportsCdrModule` and verify `/api/reports/cdr` returns expected counts for a test tenant.
2. Run parallel comparison for 1-2 weeks: compare daily call totals between v3 (`cdr_clean`) and v4 (`cdr` grouped).
3. When counts match within acceptable tolerance:
   - `DROP TRIGGER IF EXISTS bi_cdrEvents;`
4. After v3 UI is fully retired:
   - Archive or `DROP TABLE cdr_clean;`

## Rollback

Keep trigger and `cdr_clean` until step 3 is signed off. Re-enable v3 reports only if v4 is rolled back.

## Indexes (recommended)

```sql
ALTER TABLE cdr ADD INDEX idx_cdr_vpbx_calldate (vpbx_user_uid, calldate);
ALTER TABLE cdr ADD INDEX idx_cdr_linkedid (linkedid);
```
