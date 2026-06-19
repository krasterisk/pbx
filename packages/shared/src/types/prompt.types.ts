import type { IIvrPhraseTtsSettings } from './ivr-phrase.types';

export type PromptSourceType = 'file' | 'tts';

export interface IPromptTtsMeta {
  text: string;
  engine_uid: number;
  settings?: IIvrPhraseTtsSettings;
}

export interface IPrompt {
  uid: number;
  filename: string;
  comment: string;
  description: string;
  user_uid: number;
  source_type: PromptSourceType;
  tts?: IPromptTtsMeta | null;
}
