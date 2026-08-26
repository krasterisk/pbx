import * as path from 'path';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const ALLOWED_EXT = new Set(Object.keys(MIME_BY_EXT));

export function sanitizeAvatarFilename(filename: string): string | null {
  const trimmed = filename.trim();
  if (!trimmed || trimmed.includes('..') || /[\\/]/.test(trimmed)) {
    return null;
  }
  const base = path.basename(trimmed);
  if (!base || base === '.' || base === '..') {
    return null;
  }
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return null;
  }
  return base;
}

export function avatarContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

export function avatarExtFromMime(mimetype: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mimetype] || null;
}

export function resolveUnderDir(dir: string, basename: string): string | null {
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(resolvedDir, basename);
  if (resolvedFile !== resolvedDir && !resolvedFile.startsWith(`${resolvedDir}${path.sep}`)) {
    return null;
  }
  return resolvedFile;
}
