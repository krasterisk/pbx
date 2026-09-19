export type StorageRange = { start: number; end: number };

export type ObjectStore = {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string, range?: StorageRange): Promise<Buffer>;
  head(key: string): Promise<{ bytes: number } | null>;
  delete(key: string): Promise<void>;
  rename(fromKey: string, toKey: string): Promise<void>;
};

export type WriteTemporaryResult = {
  tempKey: string;
  bytes: number;
  sha256: string;
};

export type MediaStorage = {
  writeTemporary(input: {
    tenantUid: number;
    assetId: string;
    body: Buffer;
    maxBytes: number;
  }): Promise<WriteTemporaryResult>;
  commitImmutable(tempKey: string): Promise<{ key: string }>;
  stat(key: string): Promise<{ bytes: number } | null>;
  openRange(key: string, range: StorageRange): Promise<Buffer>;
  delete(key: string): Promise<void>;
};
