# Phase 3 — Validation matrix

| REQ | Check | Type |
|-----|-------|------|
| REQ-201 | One border under modal tabs; active primary underline only | manual `/ivrs` modal |
| REQ-202 | «Фразы» tab section contrast on light theme | manual |
| REQ-203 | IvrsPage Moh-like shell + listTitle Card | manual |
| REQ-204 | No Tailwind layout classes in pages/ivrs features touched; SCSS uses var(--color-*) | code review |
| REQ-205 | ru/en keys: tabs, listTitle, empty.*, selectPrompt | grep locales |
| REQ-206 | Create/edit/copy IVR + prompts + menu items save | manual |

## Commands

```bash
npm run build -w @krasterisk/frontend
npm run test:frontend
```

## Nyquist

| Behavior | Automated | Manual |
|----------|-----------|--------|
| IvrsTable renders | test file if exists | table + selection |
| Modal open | - | three tabs |
| i18n labels | - | RU UI strings |
