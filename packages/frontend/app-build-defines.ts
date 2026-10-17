import { execFileSync } from 'node:child_process';

export function appGitSha(): string {
  const fromEnv = process.env.APP_GIT_SHA?.trim() || process.env.VITE_APP_GIT_SHA?.trim();
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

export function appBuildDefines(): Record<string, string> {
  return {
    'import.meta.env.VITE_APP_GIT_SHA': JSON.stringify(appGitSha()),
  };
}
