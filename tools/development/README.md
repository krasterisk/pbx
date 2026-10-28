# Local backend watcher

`npm run dev:backend` / the backend workspace's `start:dev` use `nest-watch.cjs`.
It keeps Nest CLI 11's compiler, assets and configuration while serializing
application restarts. Rapid successful compilations coalesce; the old child
must exit before the newest build starts. Children run directly, without a
Windows `cmd` wrapper. A `taskkill` failure is ignored only when that exact child
is already gone; genuine failures remain visible and leave the live child alone.
No processes are selected by port or executable name.

Successful compilation restarts the child only when emitted JavaScript, source
assets or dependency metadata actually change. Assets are hashed at their source
because Nest copies them asynchronously during startup. Windows can notify TypeScript about an
unchanged declaration file; an identical build keeps the current process and
connections alive. Real emitted changes, dependency-lock changes and unexpected
child exits still restart normally. Debug builds also compare source maps.

This is a compatibility boundary for CLI 11's `createOnSuccessHook` /
`spawnChildProcess`. Review it when upgrading the CLI major version. Vendor files
are never edited. Production startup and builds continue to use their existing
commands. A second dev server on an occupied port fails rather than killing it.

Check: `node --test tools/development/nest-watch.test.cjs`.
Runtime logs and screenshots belong under the external `ARTIFACTS_ROOT`, resolved
with `tools/artifacts/paths.cjs`; do not save them in this directory.
