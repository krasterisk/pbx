# Krasterisk E2E tests (Playwright)

> **Migration notice:** New UI and API scenarios live in [`../harness/`](../harness/).
> This `e2e/` folder is retained for interim CI (`e2e.yml`) until Plan 11-08
> switches CI to `harness.yml`. Use `npm run harness:ui` for new work.

End-to-end tests covering operator/supervisor flows of the Call Center module
and other UI smoke scenarios.

## Quick start

```bash
cd e2e
npm install
npx playwright install --with-deps chromium
npm test
```

Pass credentials and target URL via environment variables:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3010 \
PW_USER=admin PW_PASS=admin \
npm test
```

## Layout

```
e2e/
├── fixtures/
│   └── auth.fixture.ts   # Pre-authenticated `page` fixture
├── tests/
│   └── operator-happy-path.spec.ts
└── playwright.config.ts
```

## Conventions

- Each spec file groups a single feature/flow.
- Use the `authenticatedPage` fixture instead of going through `/login` for every spec.
- Selectors prefer accessible roles + i18n-tolerant regexes (e.g. `Ready|Готов`).
- For features that need AMI/Asterisk state, gate the test with `test.skip(!process.env.HAS_ASTERISK)`.
