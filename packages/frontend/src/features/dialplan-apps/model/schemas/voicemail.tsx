import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildVoicemailSchema(_t: TFn): FieldSchema[] {
  return [];
}

export function summarizeVoicemail(_params: Record<string, unknown>, _t: TFn): string {
  return '';
}
