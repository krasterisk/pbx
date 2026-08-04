/**
 * Readiness gates — polls backend health and optional frontend before scenarios run.
 * Mirrors .github/workflows/e2e.yml wait-on pattern (D-H06).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import waitOn from 'wait-on';

const DEFAULT_API_URL = 'http://localhost:5010';
const DEFAULT_FRONTEND_URL = 'http://localhost:3010';
const WAIT_TIMEOUT_MS = 60_000;

export interface WaitForAppReadyOptions {
  /** Poll PLAYWRIGHT_BASE_URL when true (UI scenarios). */
  waitForFrontend?: boolean;
  /** Run npm run db:migrate from repo root when RUN_MIGRATE=1. */
  runMigrate?: boolean;
  apiUrl?: string;
  frontendUrl?: string;
  timeoutMs?: number;
}

function repoRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, '..', '..');
}

function shouldRunMigrate(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return process.env.RUN_MIGRATE === '1';
}

async function pollResource(url: string, timeoutMs: number, label: string): Promise<void> {
  console.log(`→ waiting for ${label}: ${url}`);
  await waitOn({
    resources: [url],
    timeout: timeoutMs,
    validateStatus: (status) => status >= 200 && status < 400,
  });
  console.log(`✓ ${label} ready`);
}

export async function waitForAppReady(options: WaitForAppReadyOptions = {}): Promise<void> {
  const apiUrl = (options.apiUrl ?? process.env.HARNESS_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
  const frontendUrl = (
    options.frontendUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_FRONTEND_URL
  ).replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? WAIT_TIMEOUT_MS;

  if (shouldRunMigrate(options.runMigrate)) {
    console.log('→ running db:migrate (RUN_MIGRATE=1)');
    const result = spawnSync('npm', ['run', 'db:migrate'], {
      cwd: repoRoot(),
      stdio: 'inherit',
      shell: true,
    });
    if (result.status !== 0) {
      throw new Error(`db:migrate failed with exit code ${result.status ?? 1}`);
    }
  }

  await pollResource(`${apiUrl}/api/health`, timeoutMs, 'API health');

  const waitFrontend =
    options.waitForFrontend ??
    process.env.WAIT_FOR_FRONTEND === '1';

  if (waitFrontend) {
    await pollResource(frontendUrl, timeoutMs, 'frontend');
  }
}

/** Stub — full AMI/ARI gates implemented in plan 07. */
export function isAmiReady(): boolean {
  if (process.env.HAS_ASTERISK !== '1') return false;
  // Plan 07: TCP probe to AMI_HOST:AMI_PORT
  return false;
}

/** Stub — full ARI gate implemented in plan 07. */
export function isAriReady(): boolean {
  if (process.env.HAS_ASTERISK !== '1') return false;
  // Plan 07: GET ARI_BASE_URL/asterisk/info
  return false;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('readiness.ts dry-run: exports loaded, no polling');
    return;
  }
  await waitForAppReady();
}

const isDirectRun = process.argv[1]?.includes('readiness');
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
