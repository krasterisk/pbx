# Repository layout migration — PLAN r1

Дата: 2026-10-21. Координатор: `/root chat01a15cc9-e096-7fd2-b4a1-319ff59dd48e`. Mode: `codex-direct`. Пользователь назначил только структурную миграцию krasterisk_v4; HEAD 10308472a809ba42e501ccbd2d079a097b9a1222, dirty baseline сохраняется.

1. Инвентаризировать регулярные файлы, Git index, ссылки и writers; согласовать с CDR, Autodial и AI-products.
2. Сохранить принятые Markdown, текущие планы и архив GSD в `docs/`; выбранные инструменты — `tools/`/`harness/`, проверенные синтетические inputs — `tests/fixtures/`. Сохранить исходные bytes и mapping во внешнем журнале; не менять исторические receipts.
3. Обновить навигацию и поддерживаемых потребителей; разделить docs inputs и внешние outputs. Архивные одноразовые/приватные сценарии оставить локально, не запускать SQL/SSH/API/LLM/calls/deploy.
4. Сократить `.gitignore` до категорий и `/.planning/`; снять старую `.planning` с Git index, сохранив рабочие файлы. Перенести только существующие index blobs назначенных tracked материалов в новые пути; прежние dirty edits не stage/commit. Новые документы/fixtures остаются reviewable untracked до пользовательского коммита.
5. Закрепить правила AGENTS/guide/index; проверить SHA, доступность новых путей/fixtures, локальные docs/harness tests, syntax и обязательные root gates. Сохранить честные результаты и вернуть владение чатам.

Owned paths: назначенные `.planning` → `docs`, 5 выбранных инструментов, 7 синтетических inputs, поддерживаемые harness path consumers, AGENTS/GSD_GUIDE/.gitignore, tools/artifacts CLI/README. Product `packages/**` исполняемый код не меняется; допускается только обновление ссылок в README. Product implementation gates/roadmaps не закрывать.

Критерии: 0 tracked paths под `.planning`; все сохранённые данные доступны; index product baseline неизменен; новые Gitignore rules пропускают docs/tools/fixtures; maintained harness не читает локальную `.planning`; ни один SQL/SSH/LLM/call сценарий не запущен; тесты и ограничения зафиксированы отдельно. Независимый reviewer не назначен, собственная проверка не называется независимой.
