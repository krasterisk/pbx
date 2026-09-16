# Deferred items (16.3-03)

- `npm run test:ai -w @krasterisk/backend` is red on this branch for reasons unrelated to D-41: skill frontmatter regexes expect only `name`+`description` then `---` (voice-robots, speech-engines, numbers, users, operations), `AiAdapterRegistryService.register` no longer overwrites, `getAllTools` mock in `legacy-tool-migration.spec.ts`, concurrent apply race, and `AiChatController` continue-turn copy. Completeness + `conferences-ai.adapter` suites are green.
