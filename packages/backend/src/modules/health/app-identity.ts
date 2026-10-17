import { execFileSync } from 'child_process';
import { APP_VERSION } from '@krasterisk/shared';
import { currentSchemaVersion } from '../../database/schema-stamp';

export function resolveGitSha(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.APP_GIT_SHA?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

let gitSha: string | undefined;

/** Release version, build SHA, and the schema recorded at startup. */
export function appIdentity(): { version: string; sha: string; schema: string | null } {
  if (!gitSha) gitSha = resolveGitSha();
  return { version: APP_VERSION, sha: gitSha, schema: currentSchemaVersion() };
}

export function withAppIdentity<T extends object>(body: T): T & { version: string; sha: string; schema: string | null } {
  return { ...body, ...appIdentity() };
}
