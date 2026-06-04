/** Per-phrase TTS overrides (merged over tts_engines.settings at synthesis time). */
export interface IIvrPhraseTtsSettings {
  voice?: string;
  speed?: string | number;
  role?: string;
  pitch_shift?: string;
  language_code?: string;
  speaking_rate?: string;
}

export type IIvrPhrase =
  | { kind: 'audio'; filename: string }
  | {
      kind: 'tts';
      text: string;
      engine_uid: number;
      settings?: IIvrPhraseTtsSettings;
    };
