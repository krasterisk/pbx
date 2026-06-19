import * as path from 'path';

const MIME_BY_EXT: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.gsm': 'audio/x-gsm',
  '.ulaw': 'audio/basic',
  '.alaw': 'audio/basic',
};

export function sanitizePromptFilename(filename: string): string | null {
  const trimmed = filename.trim();
  if (!trimmed || trimmed.includes('..') || /[\\/]/.test(trimmed)) {
    return null;
  }
  const base = path.basename(trimmed);
  if (!base || base === '.' || base === '..') {
    return null;
  }
  return base;
}

export function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

/** Candidate basenames to probe under tenant sounds directory. */
export function promptAudioCandidates(filename: string): string[] {
  const safe = sanitizePromptFilename(filename);
  if (!safe) return [];

  if (path.extname(safe)) {
    return [safe];
  }

  return [`${safe}.wav`, `${safe}.WAV`, `${safe}.gsm`, `${safe}.mp3`, safe];
}

export function resolveUnderDir(dir: string, basename: string): string | null {
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(resolvedDir, basename);
  if (resolvedFile !== resolvedDir && !resolvedFile.startsWith(`${resolvedDir}${path.sep}`)) {
    return null;
  }
  return resolvedFile;
}
