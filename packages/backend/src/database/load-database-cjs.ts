import { createRequire } from 'module';
import { existsSync } from 'fs';
import { join } from 'path';

const req = createRequire(__filename);

/**
 * Nest --watch often skips .cjs assets on Windows. Prefer dist, fall back to src.
 */
export function loadDatabaseCjs<T extends object>(filename: string): T {
  const beside = join(__dirname, filename);
  const fromSrc = join(__dirname, '..', '..', 'src', 'database', filename);
  if (existsSync(beside)) return req(beside) as T;
  if (existsSync(fromSrc)) return req(fromSrc) as T;
  throw new Error(`Cannot find ${filename}. Tried ${beside} and ${fromSrc}`);
}
