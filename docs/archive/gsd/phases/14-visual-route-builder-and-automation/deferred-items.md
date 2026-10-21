# Deferred items (14-02)

- `directories.service.spec.ts` lookup/csv suites fail on the current working tree because `directory-normalization.util.ts` re-exports `normalizeDirectoryKey` from `@krasterisk/shared` while that export is still uncommitted WIP. Out of scope for 14-02. Reference/409 suites pass via `--testNamePattern="references and deletion"`.
