import { z } from 'zod';

export const responseSchema = z.strictObject({ type: z.enum(['none', 'tts', 'prompt']), value: z.string().max(12000).optional() });
export const nextStateSchema = z.strictObject({
  type: z.enum(['listen', 'switch_group', 'transfer_exten', 'webhook', 'search_data_list', 'hangup']),
  target: z.union([z.string().max(2048), z.number().int().positive()]).optional(),
});
export const slotSchema = z.strictObject({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).max(64),
  type: z.enum(['digits', 'phone', 'yes_no', 'date', 'choice', 'freetext']),
  prompt: responseSchema,
  choices: z.array(z.strictObject({ value: z.string().min(1), label: z.string().optional(), synonyms: z.array(z.string()) })).max(100).optional(),
  maxRetries: z.number().int().min(1).max(10).optional(), retryPrompt: responseSchema.optional(),
  validationPattern: z.string().max(512).optional(),
});
const searchFields = {
  querySource: z.enum(['last_utterance', 'slot']), querySlotName: z.string().optional(),
  returnField: z.string().min(1).max(64), resultVariable: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).max(64),
  notFoundResponse: responseSchema.optional(), onFoundResponse: responseSchema.optional(),
  onFoundNextState: nextStateSchema.optional(), notFoundNextState: nextStateSchema.optional(),
  maxNotFoundRetries: z.number().int().min(1).max(10).optional(), multiMatchStrategy: z.enum(['best', 'random']).optional(),
} as const;
const actionFields = {
  response: responseSchema, nextState: nextStateSchema, slots: z.array(slotSchema).max(20).optional(),
  webhookPayload: z.record(z.string(), z.string()).optional(), webhookResponseTemplate: z.string().max(12000).optional(),
  webhookAuth: z.strictObject({ mode: z.enum(['none', 'bearer', 'custom']), token: z.string().optional(),
    customHeaders: z.array(z.strictObject({ key: z.string(), value: z.string() })).optional() }).optional(),
  dtmfAlternative: z.string().optional(), delayMs: z.number().int().min(0).max(30000).optional(),
};
export const botActionSchema = z.strictObject({ ...actionFields,
  dataListSearch: z.strictObject({ listId: z.number().int().positive(), ...searchFields }).optional() });
export const portableBotActionSchema = z.strictObject({ ...actionFields,
  dataListSearch: z.strictObject({ listKey: z.string().regex(/^list:[A-Za-z0-9_-]+$/).nullable(), ...searchFields }).optional() });
export const groupFields = {
  name: z.string().trim().min(1).max(255), description: z.string().max(12000).nullable(),
  priority: z.number().int().min(0).max(100000), active: z.boolean(), is_global: z.boolean(),
};
const keywordFields = {
  keywords: z.string().trim().min(1).max(2000), negative_keywords: z.array(z.string().max(2000)).max(100),
  synonyms: z.array(z.string().trim().min(1).max(2000)).max(100), max_repeats: z.number().int().min(0).max(100),
  priority: z.number().int().min(0).max(100000), comment: z.string().max(512).nullable(), tag: z.string().max(255).nullable(),
};
export const keywordSchema = z.strictObject({ ...keywordFields, bot_action: botActionSchema.nullable(), escalation_action: botActionSchema.nullable() });
export const portableKeywordSchema = z.strictObject({ ...keywordFields, bot_action: portableBotActionSchema.nullable(), escalation_action: portableBotActionSchema.nullable() });
export const dataListFields = {
  name: z.string().trim().min(1).max(255), description: z.string().max(12000).nullable(),
  columns: z.array(z.strictObject({ key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).max(64), label: z.string().min(1).max(255), searchable: z.boolean() })).min(1).max(30),
  rows: z.array(z.record(z.string(), z.string().max(12000))).max(5000),
};
export const dataListSchema = z.strictObject(dataListFields);
export const scenarioFileSchema = z.strictObject({
  format: z.literal('krasterisk.voice-robot.scenario'), version: z.literal(1), exportedAt: z.string().datetime(),
  scenario: z.strictObject({ greetingTtsText: z.string().max(12000).nullable(), initialGroupKey: z.string().nullable(),
    fallbackBotAction: portableBotActionSchema.nullable(), maxRetriesBotAction: portableBotActionSchema.nullable(),
    dataLists: z.array(z.strictObject({ key: z.string().regex(/^list:[A-Za-z0-9_-]+$/), ...dataListFields })).max(50),
    groups: z.array(z.strictObject({ key: z.string().regex(/^group:[A-Za-z0-9_-]+$/), ...groupFields,
      keywords: z.array(portableKeywordSchema).max(200) })).min(1).max(100),
  }),
});
export type ScenarioFile = z.infer<typeof scenarioFileSchema>;
export type PortableAction = z.infer<typeof portableBotActionSchema>;

export function scenarioActions(file: ScenarioFile): Array<{ path: string; action: PortableAction }> {
  const result: Array<{ path: string; action: PortableAction }> = [];
  const add = (path: string, action: PortableAction | null) => { if (action) result.push({ path, action }); };
  add('fallbackBotAction', file.scenario.fallbackBotAction); add('maxRetriesBotAction', file.scenario.maxRetriesBotAction);
  for (const group of file.scenario.groups) group.keywords.forEach((kw, index) => {
    add(`${group.key}.keywords[${index}].bot_action`, kw.bot_action);
    add(`${group.key}.keywords[${index}].escalation_action`, kw.escalation_action);
  });
  return result;
}

/** Strict structural AND cross-reference checks; frontend v1 envelopes stay portable. */
export function validateScenario(raw: unknown) {
  const parsed = scenarioFileSchema.safeParse(raw);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`), warnings: [] as string[] };
  const file = parsed.data; const errors: string[] = []; const warnings: string[] = [];
  if (file.scenario.groups.reduce((n, g) => n + g.keywords.length, 0) > 1000) errors.push('Scenario exceeds total 1000 keywords');
  if (file.scenario.dataLists.reduce((n, l) => n + l.rows.length, 0) > 10000) errors.push('Scenario exceeds total 10000 data-list rows');
  const groups = new Map(file.scenario.groups.map(g => [g.key, g]));
  const lists = new Map(file.scenario.dataLists.map(l => [l.key, l]));
  if (groups.size !== file.scenario.groups.length) errors.push('Duplicate group key');
  if (lists.size !== file.scenario.dataLists.length) errors.push('Duplicate list key');
  const start = file.scenario.initialGroupKey && groups.get(file.scenario.initialGroupKey);
  if (file.scenario.initialGroupKey && !start) errors.push('initialGroupKey does not exist');
  if (start && (!start.active || start.is_global || !start.keywords.length)) errors.push('Initial group must be active, non-global and have keywords');
  if (!file.scenario.initialGroupKey) warnings.push('Explicit initialGroupKey recommended; automatic group ordering is not guaranteed');
  for (const list of lists.values()) {
    const keys = new Set(list.columns.map(c => c.key));
    if (keys.size !== list.columns.length) errors.push(`${list.key}: duplicate column key`);
    if (!list.columns.some(c => c.searchable)) errors.push(`${list.key}: no searchable columns`);
    for (const row of list.rows) if (Object.keys(row).some(key => !keys.has(key))) errors.push(`${list.key}: row contains unknown column`);
  }
  const checkNext = (next: z.infer<typeof nextStateSchema> | undefined, path: string) => {
    if (!next) return;
    if (next.type === 'switch_group') {
      const group = groups.get(String(next.target));
      if (!group || !group.active || !group.keywords.length) errors.push(`${path}: switch_group target must reference an active nonempty group`);
    }
    if (next.type === 'transfer_exten' && !String(next.target ?? '').trim()) errors.push(`${path}: transfer target required`);
    if (next.type === 'webhook' && !/^https?:\/\/[^\s]+$/.test(String(next.target ?? ''))) errors.push(`${path}: HTTP(S) webhook URL required`);
    if (next.type === 'search_data_list' && path.includes('NextState')) errors.push(`${path}: nested search action has no dataListSearch configuration`);
  };
  for (const { path, action } of scenarioActions(file)) {
    checkNext(action.nextState, path);
    const names = new Set(action.slots?.map(s => s.name) ?? []);
    if (names.size !== (action.slots?.length ?? 0)) errors.push(`${path}: duplicate slot name`);
    for (const slot of action.slots ?? []) {
      if (slot.type === 'choice' && !slot.choices?.length) errors.push(`${path}: choice slot requires choices`);
      if (slot.validationPattern) warnings.push(`${path}: validationPattern is not enforced by this runtime`);
    }
    if (action.delayMs !== undefined || action.dtmfAlternative !== undefined) warnings.push(`${path}: delayMs/dtmfAlternative are not executed by this runtime`);
    if (action.nextState.type === 'search_data_list' && !action.dataListSearch) errors.push(`${path}: dataListSearch required`);
    if (action.dataListSearch) {
      const search = action.dataListSearch; const list = lists.get(search.listKey ?? '');
      if (!list) errors.push(`${path}: listKey does not exist`);
      else if (!list.columns.some(c => c.key === search.returnField)) errors.push(`${path}: returnField does not exist`);
      checkNext(search.onFoundNextState, `${path}.onFoundNextState`); checkNext(search.notFoundNextState, `${path}.notFoundNextState`);
      if (search.querySource === 'slot' && !search.querySlotName) errors.push(`${path}: querySlotName required`);
      warnings.push(`${path}: search waits for NEXT utterance, which overrides querySource; retries require entering the search action again`);
    }
  }
  for (const group of groups.values()) for (const kw of group.keywords) {
    if (!kw.bot_action) warnings.push(`${group.key}: null bot_action uses legacy dialplan routing`);
    if (kw.negative_keywords.length) warnings.push(`${group.key}: negative keywords depend on semantic routing; disabled in mpbx pilot`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

export function requireScenario(raw: unknown): ScenarioFile {
  const result = validateScenario(raw);
  if (!result.valid) throw new Error(`INVALID_SCENARIO: ${result.errors.join('; ')}`);
  return scenarioFileSchema.parse(raw);
}

export function mapPortableAction(action: PortableAction | null, groups: Map<string, number>, lists: Map<string, number>) {
  if (!action) return null;
  const next = (state: z.infer<typeof nextStateSchema> | undefined) => state && ({ ...state,
    ...(state.type === 'switch_group' ? { target: String(groups.get(String(state.target))!) } : {}) });
  const { dataListSearch, ...rest } = action;
  return { ...rest, nextState: next(rest.nextState), ...(dataListSearch ? { dataListSearch: {
    ...dataListSearch, listKey: undefined, listId: lists.get(dataListSearch.listKey!)!,
    onFoundNextState: next(dataListSearch.onFoundNextState), notFoundNextState: next(dataListSearch.notFoundNextState),
  } } : {}) };
}
