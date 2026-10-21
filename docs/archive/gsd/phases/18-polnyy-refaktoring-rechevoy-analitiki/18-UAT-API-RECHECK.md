# 18-UAT-API-RECHECK — живой API re-check UUID (G-18-06 / D-50)

Чеклист для **позднего** ручного обновления evidence после деплоя 18-16/18-17.
Автоматический verify **не** гоняет полный каталог `Z:\temp\speech-analytics-samples`.

**Секреты:** plaintext API-токены **никогда** не коммитить. В evidence — только ids (recordingId / runId / journalId), без digest/токена.

## Шаги

1. **Токен.** После деплоя 18-16/18-17 выпустить **один** SA API-токен для **опубликованного** проекта (lab tenant). Токен хранить вне git.

2. **Малый sample upload.** `POST /api/v1/speech-analytics/uploads/batch` с **одним** маленьким mono-фикстуром и **одним** маленьким stereo-фикстуром — только эти два файла. **Не** перегонять полный каталог `Z:\temp\speech-analytics-samples` в рамках этого плана.

3. **UUID в sa_*.** В ответе и в БД убедиться, что `recordingId` / `runId` / `journalId` — UUID и присутствуют в `sa_recordings` / `sa_analysis_runs`. Успех **не** допускает префикс `journal:`.

4. **Без списания.** Подтвердить `charged === false` и отсутствие wallet debit (D-46…D-49). Не вызывать settleShadow / не списывать кошелёк.

5. **Evidence (опционально).** Позже обновить секцию `api` в `.planning/evidence/speech-analytics-uat-live.json` (ids only; без plaintext токена).

## Что не делать

- Полный crawl `Z:\temp\speech-analytics-samples` в CI / automated verify
- Wallet debit / settleShadow
- Коммит plaintext токенов или JWT
