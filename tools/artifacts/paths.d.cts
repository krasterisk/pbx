export function artifactPath<T>(value: T, options?: { write?: boolean }): T;
export function artifactsRoot(): string;
export function outputPath(...parts: string[]): string;
export function isArtifact(relative: string): boolean;
export const repository: string;
