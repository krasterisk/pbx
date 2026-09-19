import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class DomainError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ?? code);
  }
}

const RELATIVE = /^[a-zA-Z0-9._/-]+$/;

export function assertSpoolRelativeKey(key: string): void {
  if (!RELATIVE.test(key) || key.includes('..') || path.isAbsolute(key) || key.startsWith('/')) {
    throw new DomainError('spool_key_invalid', 400);
  }
}

export function spoolStates(): readonly string[] {
  return ['recording', 'closed', 'probing', 'upload_pending', 'acknowledged', 'retained', 'purged', 'quarantined'];
}

export async function writeManifestAtomic(directory: string, recordingUid: string, body: string): Promise<string> {
  assertSpoolRelativeKey(`${recordingUid}.json`);
  await fs.promises.mkdir(directory, { recursive: true });
  const temp = path.join(directory, `${recordingUid}.json.tmp`);
  const dest = path.join(directory, `${recordingUid}.json`);
  await fs.promises.writeFile(temp, body, { flag: 'wx' });
  const handle = await fs.promises.open(temp, 'r+');
  await handle.sync();
  await handle.close();
  await fs.promises.rename(temp, dest);
  return dest;
}

export function journalAppend(directory: string, line: string): void {
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(path.join(directory, 'journal.log'), `${line}\n`);
}

export function sha256FileSync(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function reconcileOpenRecording(state: string): 'quarantined' | 'closed' {
  return state === 'recording' ? 'quarantined' : 'closed';
}
