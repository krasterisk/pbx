let schemaVersion: string | null = null;

export function rememberSchemaVersion(version: string | null | undefined): void {
  if (typeof version === 'string' && version.length > 0) schemaVersion = version;
}

export function currentSchemaVersion(): string | null {
  return schemaVersion;
}

export function resetSchemaVersionForTests(): void {
  schemaVersion = null;
}
