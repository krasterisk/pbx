export function checkSchemaReadiness(input?: NodeJS.Dict<string>): Promise<{ engine: 'mysql' | 'postgres'; schemaVersion: string }>;
