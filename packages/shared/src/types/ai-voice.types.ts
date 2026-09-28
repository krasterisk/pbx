/** Effective configuration shared by the editor, persisted revisions and voice sessions. */
export interface AiVoiceRobotConfig {
  name: string;
  uniqueId: string;
  enabled: boolean;
  instruction: string;
  greeting: string;
  comment: string;
  mode: 'realtime' | 'cascade';
  modelProfileId: number | null;
  sttProfileId: number | null;
  ttsProfileId: number | null;
  model: string;
  voice: string;
  ttsVoice: string;
  temperature: number;
  maxResponseOutputTokens: number | 'inf';
  inputAudioFormat: 'pcm16' | 'g711_alaw' | 'g711_ulaw';
  outputAudioFormat: 'pcm16' | 'g711_alaw' | 'g711_ulaw';
  inputTranscriptionModel: string;
  inputTranscriptionLanguage: string;
  outputTranscriptionModel: string;
  noiseReduction: 'none' | 'near_field' | 'far_field';
  turnDetection: 'server_vad' | 'none';
  vadThreshold: number;
  prefixPaddingMs: number;
  silenceDurationMs: number;
  idleTimeoutMs: number;
  semanticEagerness: string;
  interruptResponse: boolean;
  analytic: boolean;
  allowHangup: boolean;
  allowTransfer: boolean;
  transferTargets: string[];
  toolIds: string[];
  mcpServerIds: string[];
  knowledgeBaseIds: string[];
  maxCallMs: number;
}

export interface AiVoiceRobot {
  uid: number;
  robotUuid: string;
  revision: number;
  versionId: string | null;
  config: AiVoiceRobotConfig;
}

export const AI_VOICE_ROBOT_DEFAULTS: Readonly<AiVoiceRobotConfig> = {
  name: '', uniqueId: '', enabled: true, instruction: '', greeting: '', comment: '',
  mode: 'realtime', modelProfileId: null, sttProfileId: null, ttsProfileId: null,
  model: '', voice: 'alloy', ttsVoice: '', temperature: 0.8, maxResponseOutputTokens: 'inf',
  inputAudioFormat: 'g711_alaw', outputAudioFormat: 'g711_alaw',
  inputTranscriptionModel: 'whisper-1', inputTranscriptionLanguage: 'ru', outputTranscriptionModel: '',
  noiseReduction: 'near_field', turnDetection: 'server_vad', vadThreshold: 0.5,
  prefixPaddingMs: 500, silenceDurationMs: 1000, idleTimeoutMs: 10000, semanticEagerness: '',
  interruptResponse: true, analytic: true, allowHangup: false, allowTransfer: false,
  transferTargets: [], toolIds: [], mcpServerIds: [], knowledgeBaseIds: [], maxCallMs: 600000,
};

export interface AiVoiceConfigIssue { field: keyof AiVoiceRobotConfig; code: string }

/** Reject invalid values without silently replacing user input by a default. */
export function validateAiVoiceConfig(config: AiVoiceRobotConfig): AiVoiceConfigIssue[] {
  const issues: AiVoiceConfigIssue[] = [];
  const issue = (field: keyof AiVoiceRobotConfig, code: string) => { issues.push({ field, code }); };
  for (const field of ['name', 'uniqueId', 'instruction'] as const) {
    if (typeof config[field] !== 'string' || !config[field].trim()) issue(field, 'required');
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(config.uniqueId)) issue('uniqueId', 'identifier');
  if (typeof config.name === 'string' && config.name.length > 128) issue('name', 'length');
  if (typeof config.voice !== 'string') issue('voice', 'invalid');
  else if (config.voice.length > 64) issue('voice', 'length');
  if (!['realtime', 'cascade'].includes(config.mode)) issue('mode', 'invalid');
  for (const field of ['modelProfileId', ...(config.mode === 'cascade' ? ['sttProfileId', 'ttsProfileId'] : [])] as const) {
    const key = field as 'modelProfileId' | 'sttProfileId' | 'ttsProfileId';
    if (!Number.isSafeInteger(config[key]) || Number(config[key]) <= 0) issue(key, 'required');
  }
  const ranges: Array<[keyof AiVoiceRobotConfig, number, number]> = [
    ['temperature', 0.6, 1.2], ['vadThreshold', 0, 1], ['prefixPaddingMs', 0, 1000],
    ['silenceDurationMs', 100, 5000], ['idleTimeoutMs', 6000, 60000], ['maxCallMs', 1000, 3600000],
  ];
  for (const [field, min, max] of ranges) {
    const value = config[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) issue(field, 'range');
  }
  if (config.maxResponseOutputTokens !== 'inf'
    && (!Number.isSafeInteger(config.maxResponseOutputTokens) || config.maxResponseOutputTokens < 1)) {
    issue('maxResponseOutputTokens', 'range');
  }
  for (const field of ['inputAudioFormat', 'outputAudioFormat'] as const) {
    if (!['pcm16', 'g711_alaw', 'g711_ulaw'].includes(config[field])) issue(field, 'invalid');
  }
  if (!['none', 'near_field', 'far_field'].includes(config.noiseReduction)) issue('noiseReduction', 'invalid');
  if (!['server_vad', 'none'].includes(config.turnDetection)) issue('turnDetection', 'invalid');
  if (config.mode === 'realtime' && (typeof config.voice !== 'string' || !config.voice.trim())) issue('voice', 'required');
  for (const field of ['toolIds', 'mcpServerIds', 'knowledgeBaseIds', 'transferTargets'] as const) {
    if (!Array.isArray(config[field]) || config[field].length > 100
      || config[field].some(value => typeof value !== 'string' || !value || value.length > 128)) issue(field, 'invalid');
  }
  // Both supported databases use TEXT here; bound UTF-8 bytes, not JS character count.
  if (new TextEncoder().encode(JSON.stringify(config)).byteLength > 48000) issue('instruction', 'length');
  return issues;
}
