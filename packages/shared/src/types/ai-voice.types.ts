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

export interface AiRobotConfigV2 {
  schemaVersion: 2;
  identity: { name: string; uniqueId: string; enabled: boolean; comment: string };
  persona: { role: string; goal: string; style: string; rules: string[]; handoffWhen: string[] };
  prompt: { instruction: string; greeting: string; speaksFirst: boolean; variables: string[] };
  speech: {
    preset: 'fast' | 'balanced' | 'quality' | 'custom';
    mode: 'realtime' | 'cascade';
    modelProfileId: number | null;
    sttProfileId: number | null;
    ttsProfileId: number | null;
    model: string;
    voice: string;
    ttsVoice: string;
    language: string;
    temperature: number;
    maxResponseOutputTokens: number | 'inf';
    inputAudioFormat: AiVoiceRobotConfig['inputAudioFormat'];
    outputAudioFormat: AiVoiceRobotConfig['outputAudioFormat'];
  };
  behavior: {
    turnDetection: 'server_vad' | 'semantic_vad';
    eagerness: 'low' | 'medium' | 'high' | 'auto';
    vadThreshold: number;
    prefixPaddingMs: number;
    silenceDurationMs: number;
    idleTimeoutMs: number;
    interruptible: boolean;
    noiseReduction: AiVoiceRobotConfig['noiseReduction'];
    maxCallMs: number;
    failurePhrase: string;
  };
  knowledge: { baseIds: string[]; mode: 'on_demand' | 'always'; topK: number };
  tools: {
    allowHangup: boolean;
    allowTransfer: boolean;
    transferTargets: string[];
    toolIds: string[];
    mcpServerIds: string[];
  };
  analysis: { analytic: boolean; outcomes: string[] };
}

export function toRobotConfigV2(config: AiVoiceRobotConfig): AiRobotConfigV2 {
  const eagerness = (['low', 'medium', 'high', 'auto'] as const).includes(config.semanticEagerness as 'low')
    ? config.semanticEagerness as AiRobotConfigV2['behavior']['eagerness']
    : 'auto';
  return {
    schemaVersion: 2,
    identity: { name: config.name, uniqueId: config.uniqueId, enabled: config.enabled, comment: config.comment },
    persona: { role: '', goal: '', style: '', rules: [], handoffWhen: [] },
    prompt: {
      instruction: config.instruction, greeting: config.greeting, speaksFirst: Boolean(config.greeting.trim()),
      variables: [],
    },
    speech: {
      preset: 'custom', mode: config.mode, modelProfileId: config.modelProfileId, sttProfileId: config.sttProfileId,
      ttsProfileId: config.ttsProfileId, model: config.model, voice: config.voice, ttsVoice: config.ttsVoice,
      language: config.inputTranscriptionLanguage, temperature: config.temperature,
      maxResponseOutputTokens: config.maxResponseOutputTokens,
      inputAudioFormat: config.inputAudioFormat, outputAudioFormat: config.outputAudioFormat,
    },
    behavior: {
      turnDetection: 'server_vad',
      eagerness, vadThreshold: config.vadThreshold, prefixPaddingMs: config.prefixPaddingMs,
      silenceDurationMs: config.silenceDurationMs, idleTimeoutMs: config.idleTimeoutMs,
      interruptible: config.interruptResponse, noiseReduction: config.noiseReduction,
      maxCallMs: config.maxCallMs, failurePhrase: 'Извините, сейчас не получается ответить. Я соединю вас дальше.',
    },
    knowledge: { baseIds: [...config.knowledgeBaseIds], mode: 'on_demand', topK: 5 },
    tools: {
      allowHangup: config.allowHangup, allowTransfer: config.allowTransfer,
      transferTargets: [...config.transferTargets], toolIds: [...config.toolIds], mcpServerIds: [...config.mcpServerIds],
    },
    analysis: { analytic: config.analytic, outcomes: ['completed', 'transferred', 'no_input', 'failed'] },
  };
}

/** Flatten v2 back onto the persisted v1 shape without dropping fields the editor still writes. */
export function fromRobotConfigV2(v2: AiRobotConfigV2, base: AiVoiceRobotConfig = AI_VOICE_ROBOT_DEFAULTS): AiVoiceRobotConfig {
  return {
    ...base,
    name: v2.identity.name, uniqueId: v2.identity.uniqueId, enabled: v2.identity.enabled, comment: v2.identity.comment,
    instruction: v2.prompt.instruction, greeting: v2.prompt.greeting, mode: v2.speech.mode,
    modelProfileId: v2.speech.modelProfileId, sttProfileId: v2.speech.sttProfileId, ttsProfileId: v2.speech.ttsProfileId,
    model: v2.speech.model, voice: v2.speech.voice, ttsVoice: v2.speech.ttsVoice,
    inputTranscriptionLanguage: v2.speech.language, temperature: v2.speech.temperature,
    maxResponseOutputTokens: v2.speech.maxResponseOutputTokens,
    inputAudioFormat: v2.speech.inputAudioFormat, outputAudioFormat: v2.speech.outputAudioFormat,
    semanticEagerness: v2.behavior.eagerness, vadThreshold: v2.behavior.vadThreshold,
    prefixPaddingMs: v2.behavior.prefixPaddingMs, silenceDurationMs: v2.behavior.silenceDurationMs,
    idleTimeoutMs: v2.behavior.idleTimeoutMs, interruptResponse: v2.behavior.interruptible,
    noiseReduction: v2.behavior.noiseReduction, maxCallMs: v2.behavior.maxCallMs,
    knowledgeBaseIds: [...v2.knowledge.baseIds], allowHangup: v2.tools.allowHangup,
    allowTransfer: v2.tools.allowTransfer, transferTargets: [...v2.tools.transferTargets],
    toolIds: [...v2.tools.toolIds], mcpServerIds: [...v2.tools.mcpServerIds], analytic: v2.analysis.analytic,
  };
}

export interface AiRobotTemplate {
  id: string;
  name: string;
  description: string;
  config: Partial<AiVoiceRobotConfig>;
}

export const AI_ROBOT_TEMPLATES: readonly AiRobotTemplate[] = [
  {
    id: 'reception', name: 'Секретарь', description: 'Приветствует и переводит на нужного сотрудника',
    config: {
      name: 'Секретарь', uniqueId: 'reception', greeting: 'Здравствуйте. Чем могу помочь?',
      instruction: 'Ты секретарь компании. Выясни, к кому обращается звонящий, и переведи разговор. Не выдумывай факты.',
      allowTransfer: true, allowHangup: true,
    },
  },
  {
    id: 'booking', name: 'Запись на приём', description: 'Собирает имя, услугу и удобное время',
    config: {
      name: 'Запись', uniqueId: 'booking', greeting: 'Здравствуйте. Я помогу записаться на приём.',
      instruction: 'Ты записываешь клиентов. Узнай имя, услугу и удобное время. Подтверди запись своими словами. Если клиент просит человека, переведи звонок.',
      allowTransfer: true, allowHangup: true,
    },
  },
  {
    id: 'support', name: 'Поддержка', description: 'Отвечает по базе знаний и переводит сложные случаи',
    config: {
      name: 'Поддержка', uniqueId: 'support', greeting: 'Здравствуйте, служба поддержки.',
      instruction: 'Отвечай только по базе знаний. Если ответа нет, честно скажи об этом и предложи перевод на оператора.',
      allowTransfer: true, allowHangup: true,
    },
  },
];

export function applyRobotTemplate(id: string): AiVoiceRobotConfig | null {
  const template = AI_ROBOT_TEMPLATES.find(item => item.id === id);
  if (!template) return null;
  return { ...structuredClone(AI_VOICE_ROBOT_DEFAULTS), ...template.config };
}
