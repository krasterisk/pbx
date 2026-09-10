export interface IvrSetupDraft {
  title: string;
  steps: Array<{
    id: string;
    tool: string;
    args: Record<string, unknown>;
    dependsOn?: string[];
    label?: string;
  }>;
}

type DestKind = 'extension' | 'group' | 'queue' | 'hangup' | 'voicemail' | 'playback' | 'chain';

interface Dest {
  kind: DestKind;
  target?: string;
  name?: string;
  files?: string;
  actions?: Array<{ type: string; params: Record<string, unknown> }>;
}

interface ParsedBrief {
  name: string;
  greeting: string;
  digits: Record<string, Dest>;
  timeout: Dest;
  invalid?: Dest;
  groupExten: string;
  queueExten: string;
}

/**
 * Deterministic propose_plan payload from a complete IVR brief.
 * Used so a local 8B model never has to invent the workflow JSON.
 */
export function buildIvrSetupDraft(message: string): IvrSetupDraft | null {
  const parsed = parseIvrBrief(message);
  if (!parsed) return null;
  return draftFromParsed(parsed);
}

export function isCompleteIvrBrief(message: string): boolean {
  return parseIvrBrief(message) != null;
}

function parseIvrBrief(message: string): ParsedBrief | null {
  const name = extractIvrName(message);
  const greeting = extractGreeting(message);
  if (!name || !greeting) return null;

  const digits = parseDigitDestinations(message);
  const timeout = parseTimeoutDest(message) ?? defaultTimeout(message, digits);
  const invalid = parseInvalidDest(message);
  const keys = Object.keys(digits);
  if (keys.length < 1) return null;
  if (keys.length < 2 && !timeout) return null;

  return {
    name,
    greeting,
    digits,
    timeout,
    invalid,
    groupExten: readGroupExtenFromMessage(message) ?? defaultGroupExten(name),
    queueExten: readQueueExtenFromMessage(message) ?? defaultQueueExten(name),
  };
}

function draftFromParsed(parsed: ParsedBrief): IvrSetupDraft {
  const { name, greeting, digits, timeout, invalid, groupExten, queueExten } = parsed;
  const extensionTargets = collectExtensions(digits, timeout, invalid);
  const needsGroup = hasKind(digits, timeout, invalid, 'group')
    || (timeout.kind === 'chain' && (timeout.actions ?? []).some((action) => action.type === 'togroup'));
  const queueDest = findQueue(digits, timeout, invalid);
  const resolvedQueueExten = queueDest?.target ?? queueExten;
  const queueName = queueDest?.name ?? `Очередь ${name}`;

  const pattern = extensionTargets.length >= 2 && isContiguous(extensionTargets)
    ? `${extensionTargets[0]}-${extensionTargets[extensionTargets.length - 1]}`
    : extensionTargets.join(',');

  const menuItems = [
    ...Object.entries(digits).map(([digit, dest]) => toMenuItem(digit, dest, groupExten, resolvedQueueExten)),
    toMenuItem('t', timeout, groupExten, resolvedQueueExten),
    ...(invalid ? [toMenuItem('i', invalid, groupExten, resolvedQueueExten)] : []),
  ];

  const steps: IvrSetupDraft['steps'] = [];
  if (extensionTargets.length) {
    steps.push({
      id: 'endpoints',
      tool: 'create_endpoints_bulk',
      args: { extensionsPattern: pattern, displayNamePattern: 'Абонент {N}' },
      label: `Создать отсутствующих абонентов ${pattern}`,
    });
  }
  if (needsGroup) {
    const members = extensionTargets.length ? extensionTargets : ['101'];
    steps.push({
      id: 'group',
      tool: 'create_call_group',
      dependsOn: extensionTargets.length ? ['endpoints'] : undefined,
      args: {
        name: `Группа ${name}`,
        exten: groupExten,
        strategy: 'ringall',
        members: members.map((value, position) => ({
          member_type: 'internal',
          value,
          position,
        })),
      },
      label: `Группа таймаута ${groupExten}`,
    });
  }
  if (queueDest) {
    steps.push({
      id: 'queue',
      tool: 'create_queue',
      dependsOn: extensionTargets.length ? ['endpoints'] : undefined,
      args: {
        name: queueName,
        exten: resolvedQueueExten,
        strategy: 'leastrecent',
      },
      label: `Очередь ${queueName} ${resolvedQueueExten}`,
    });
  }

  const ivrDepends = [
    ...(needsGroup ? ['group'] : []),
    ...(queueDest ? ['queue'] : []),
    ...(!needsGroup && !queueDest && extensionTargets.length ? ['endpoints'] : []),
  ];
  steps.push({
    id: 'ivr',
    tool: 'create_ivr',
    dependsOn: ivrDepends.length ? ivrDepends : undefined,
    args: {
      name: `IVR - ${name}`,
      text: greeting,
      menu_items: menuItems,
    },
    label: `Меню ${name}`,
  });

  return { title: `IVR «${name}»`, steps };
}

function toMenuItem(
  digit: string,
  dest: Dest,
  groupExten: string,
  queueExten: string,
): Record<string, unknown> {
  if (dest.kind === 'extension' && dest.target) {
    return { digit, destination: { kind: 'extension', target: dest.target } };
  }
  if (dest.kind === 'group') {
    return { digit, destination: { kind: 'group', target: dest.target ?? groupExten } };
  }
  if (dest.kind === 'queue') {
    return { digit, destination: { kind: 'queue', target: dest.target ?? queueExten } };
  }
  if (dest.kind === 'hangup') {
    return { digit, actions: [{ type: 'hangup', params: { signal: 'hangup' } }] };
  }
  if (dest.kind === 'voicemail') {
    return { digit, actions: [{ type: 'voicemail', params: { max_duration: 120 } }] };
  }
  if (dest.kind === 'playback') {
    return { digit, actions: [{ type: 'playback', params: { mode: 'plain', files: dest.files || 'beep' } }] };
  }
  if (dest.kind === 'chain' && dest.actions?.length) {
    return {
      digit,
      actions: dest.actions.map((action) => {
        if (action.type !== 'togroup') return action;
        const params = action.params as { target?: { value?: string } };
        const value = String(params.target?.value ?? '').trim() || groupExten;
        return { type: 'togroup', params: { target: { source: 'fixed', value } } };
      }),
    };
  }
  return { digit, actions: [{ type: 'hangup', params: { signal: 'hangup' } }] };
}

export function extractIvrName(message: string): string | null {
  const match =
    message.match(/(?:ivr|голосовое меню|меню)\s*[-–—:]\s*[«"']?([A-Za-zА-Яа-я0-9][^.\n«"']{1,48})/i)
    ?? message.match(/«([^»]{2,48})»/);
  const name = match?.[1]?.trim().replace(/\s+/g, ' ');
  return name || null;
}

export function extractGreeting(message: string): string | null {
  const match =
    message.match(/(?:текст|приветств[^\n]{0,24})\s*:\s*[«"']([^»"']{3,400})[»"']/i)
    ?? message.match(/[«"']([^»"']{20,400})[»"']/);
  const text = match?.[1]?.trim();
  return text || null;
}

export function extractDigitMap(message: string): Record<string, string> {
  const digits: Record<string, string> = {};
  for (const [digit, dest] of Object.entries(parseDigitDestinations(message))) {
    if (dest.kind === 'extension' && dest.target) digits[digit] = dest.target;
  }
  return digits;
}

function parseDigitDestinations(message: string): Record<string, Dest> {
  const digits: Record<string, Dest> = {};
  for (const row of message.matchAll(/\b([1-9*#0])\s*[-–—:]\s*(?:абонент\s*)?(\d{2,8})\b/gi)) {
    digits[row[1]] = { kind: 'extension', target: row[2] };
  }
  for (const row of message.matchAll(/(?:цифр[аы]?|digit)\s*([1-9*#0])\s*(?:→|->|—|-|на|to)\s*(?:абонент\s*)?(\d{2,8})/gi)) {
    digits[row[1]] = { kind: 'extension', target: row[2] };
  }
  for (const line of message.split(/\n|;/)) {
    const labeled = line.match(/^\s*(?:цифр[аы]?\s*)?([1-9*#0])\s*[-–—:=]\s*(.+)$/i);
    if (!labeled) continue;
    const dest = parseDestPhrase(stripTrailingRouting(labeled[2])) ?? parseDestPhrase(labeled[2]);
    if (dest && dest.kind !== 'group') digits[labeled[1]] = dest;
    else if (dest && !digits[labeled[1]]) digits[labeled[1]] = dest;
  }
  return digits;
}

function parseTimeoutDest(message: string): Dest | null {
  const line = message.match(/(?:таймаут|ничего не нажал[аи]?|оставайтесь на линии|остаться на линии)\s*[-–—:=]\s*(.+)/i);
  if (line) {
    const dest = parseDestPhrase(line[1]);
    if (dest) {
      if (dest.kind === 'group' && /(?:затем|потом|иначе|после)\s*(?:сброс|hangup|трубк)/i.test(line[1])) {
        return groupThenHangup(dest.target);
      }
      return dest;
    }
  }
  if (/(?:ничего не нажал|оставайтесь на линии|звонят все|группа вызова|ringall)/i.test(message)
    && !/(?:таймаут|ничего не нажал).{0,40}(?:сброс|hangup|трубк)/i.test(message)) {
    const afterHangup = /(?:группа|звонят все).{0,40}(?:затем|потом|иначе)\s*(?:сброс|hangup|трубк)/i.test(message);
    return afterHangup ? groupThenHangup() : { kind: 'group' };
  }
  return null;
}

function parseInvalidDest(message: string): Dest | undefined {
  const line = message.match(/(?:неверн[а-я]*\s+ввод|цифра\s+i\b|\bi\s*[-–—:=])\s*(.+)/i);
  if (!line) return undefined;
  return parseDestPhrase(line[1]) ?? undefined;
}

function defaultTimeout(message: string, digits: Record<string, Dest>): Dest {
  if (/(?:сброс|hangup|полож[а-я]* трубк|заверш[а-я]* вызов)/i.test(message) && !hasKind(digits, undefined, undefined, 'group')) {
    return { kind: 'hangup' };
  }
  if (/(?:групп|ringall|звонят все)/i.test(message)) return { kind: 'group' };
  return { kind: 'hangup' };
}

function stripTrailingRouting(phrase: string): string {
  return phrase
    .replace(/\s*(?:ничего не нажал.*|таймаут\s*[-–—:].*|неверн[а-я]*\s+ввод.*)$/i, '')
    .trim();
}

function parseDestPhrase(raw: string): Dest | null {
  const phrase = raw.trim();
  if (!phrase) return null;
  if (/(?:сброс|hangup|полож[а-я]* трубк|заверш[а-я]* вызов)/i.test(phrase)
    && !/(?:абонент|очеред|групп|voicemail|почт|playback|проиграть)/i.test(phrase)) {
    return { kind: 'hangup' };
  }
  if (/(?:группа|звонят все|ringall)/i.test(phrase)) {
    const exten = phrase.match(/\b(6\d{3}|\d{2,8})\b/);
    if (/(?:затем|потом|иначе)\s*(?:сброс|hangup|трубк)/i.test(phrase)) {
      return groupThenHangup(exten?.[1]);
    }
    return { kind: 'group', target: exten?.[1] };
  }
  if (/(?:очеред|queue)/i.test(phrase)) {
    const exten = phrase.match(/\b([78]\d{3}|\d{2,8})\b/);
    const named = phrase.match(/(?:очеред[ьи]|queue)\s+[«"']?([A-Za-zА-Яа-я0-9][^,.\n«"']{0,32})/i);
    return {
      kind: 'queue',
      target: exten?.[1],
      name: named?.[1]?.trim().replace(/\s+/g, ' '),
    };
  }
  if (/(?:voicemail|голосов[а-я]*\s+почт)/i.test(phrase)) {
    const box = phrase.match(/(\d{2,8})/);
    return { kind: 'voicemail', target: box?.[1] };
  }
  if (/(?:playback|проиграть|файл)/i.test(phrase)) {
    const file = phrase.match(/(?:playback|проиграть|файл)\s+[«"']?([A-Za-z0-9._-]+)/i);
    return { kind: 'playback', files: file?.[1] || 'beep' };
  }
  const ext = phrase.match(/(?:абонент\s*)?(\d{2,8})/);
  if (ext) return { kind: 'extension', target: ext[1] };
  return null;
}

function groupThenHangup(target?: string): Dest {
  return {
    kind: 'chain',
    actions: [
      { type: 'togroup', params: { target: { source: 'fixed', value: target ?? '' } } },
      { type: 'hangup', params: { signal: 'hangup' } },
    ],
  };
}

function collectExtensions(...bags: Array<Record<string, Dest> | Dest | undefined>): string[] {
  const found = new Set<string>();
  for (const bag of bags) {
    if (!bag) continue;
    const dests = 'kind' in bag ? [bag as Dest] : Object.values(bag);
    for (const dest of dests) {
      if (dest.kind === 'extension' && dest.target) found.add(dest.target);
      if (dest.kind === 'voicemail' && dest.target) found.add(dest.target);
    }
  }
  return [...found].sort((a, b) => Number(a) - Number(b));
}

function hasKind(
  digits: Record<string, Dest>,
  timeout?: Dest,
  invalid?: Dest,
  kind: DestKind = 'group',
): boolean {
  return Object.values(digits).some((dest) => dest.kind === kind)
    || timeout?.kind === kind
    || invalid?.kind === kind;
}

function findQueue(...bags: Array<Record<string, Dest> | Dest | undefined>): Dest | undefined {
  for (const bag of bags) {
    if (!bag) continue;
    const dests = 'kind' in bag ? [bag as Dest] : Object.values(bag);
    const found = dests.find((dest) => dest.kind === 'queue');
    if (found) return found;
  }
  return undefined;
}

function lastCapture(message: string, pattern: RegExp): string | null {
  const matches = [...message.matchAll(pattern)];
  return matches.at(-1)?.[1] ?? null;
}

function readGroupExtenFromMessage(message: string): string | null {
  return lastCapture(
    message,
    /(?:номер\s+групп[аыеу]?|групп[аыеу]?)(?:\s+на)?(?:\s+(?:таймаут|exten|номер))?\s*[-–—:=]?\s*(\d{2,8})/gi,
  ) ?? lastCapture(message, /\b(6\d{3})\b/g);
}

function readQueueExtenFromMessage(message: string): string | null {
  const match = message.match(/(?:номер очереди|очеред[ьи]\s*(?:на)?)\s*[:=]?\s*(\d{2,8})/i)
    ?? message.match(/\b(8\d{3})\b/);
  return match?.[1] ?? null;
}

function defaultGroupExten(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 900;
  return String(6000 + hash);
}

function defaultQueueExten(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 900;
  return String(8000 + hash);
}

function isContiguous(values: string[]): boolean {
  const nums = values.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (nums.length < 2) return false;
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }
  return true;
}
