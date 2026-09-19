import { formatAiStorageRef, parseAiStorageRef, type AiStorageRef } from '@krasterisk/shared';

const OBJECT_KEY = /^t[0-9]+\/[0-9a-fA-F-]{8,36}(\.part)?$/;

export function objectKeyFor(ref: AiStorageRef): string {
  return `t${ref.tenantUid}/${ref.assetId}`;
}

export function assertSafeObjectKey(key: string): string {
  if (key.includes('\0') || /[\\]/.test(key) || key.includes('..')) {
    throw Object.assign(new Error('storage key traversal is not allowed'), { code: 'storage_path_denied' });
  }
  if (key.startsWith('/') || key.startsWith('//') || /^[a-zA-Z]:/.test(key) || key.startsWith('\\\\')) {
    throw Object.assign(new Error('absolute and UNC storage keys are not allowed'), { code: 'storage_path_denied' });
  }
  if (key.includes(':')) {
    throw Object.assign(new Error('storage key traversal is not allowed'), { code: 'storage_path_denied' });
  }
  if (!OBJECT_KEY.test(key)) {
    throw Object.assign(new Error('storage key must be tenant-prefixed and server-generated'), { code: 'storage_path_denied' });
  }
  return key;
}

export function storageRef(scheme: 'local' | 's3', tenantUid: number, assetId: string): string {
  return formatAiStorageRef({ scheme, tenantUid, assetId });
}

export function parseRef(value: string): AiStorageRef {
  return parseAiStorageRef(value);
}
