import { promises as fs } from 'fs';
import * as path from 'path';
import type { IPromptTtsMeta } from '@krasterisk/shared';
import { resolveUnderDir, sanitizePromptFilename } from './prompts-audio.util';

export function ttsMetaBasename(filename: string): string | null {
  const safe = sanitizePromptFilename(filename);
  if (!safe) return null;
  return path.extname(safe) ? path.parse(safe).name : safe;
}

export function ttsMetaFileName(filename: string): string | null {
  const base = ttsMetaBasename(filename);
  return base ? `${base}.tts.json` : null;
}

export function resolveTtsMetaPath(soundsDir: string, filename: string): string | null {
  const metaName = ttsMetaFileName(filename);
  if (!metaName) return null;
  return resolveUnderDir(soundsDir, metaName);
}

export async function readTtsMetaFile(filePath: string): Promise<IPromptTtsMeta | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as IPromptTtsMeta;
    if (!parsed?.text?.trim() || !parsed.engine_uid) {
      return null;
    }
    return {
      text: parsed.text.trim(),
      engine_uid: Number(parsed.engine_uid),
      settings: parsed.settings,
    };
  } catch {
    return null;
  }
}

export async function writeTtsMetaFile(filePath: string, meta: IPromptTtsMeta): Promise<void> {
  const payload: IPromptTtsMeta = {
    text: meta.text.trim(),
    engine_uid: meta.engine_uid,
    settings: meta.settings,
  };
  await fs.writeFile(filePath, JSON.stringify(payload), 'utf8');
}

export async function deleteTtsMetaFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore missing
  }
}
