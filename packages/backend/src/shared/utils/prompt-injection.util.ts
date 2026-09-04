export const UNTRUSTED_FENCE_OPEN = '<<<UNTRUSTED_DATA';
export const UNTRUSTED_FENCE_CLOSE = '<<<END_UNTRUSTED_DATA>>>';

const SOURCE_SAFE = /[^a-zA-Z0-9_.:-]+/g;
const FENCE_CLOSE_RE = /<<<\s*END_UNTRUSTED_DATA\s*>>>/gi;
const FENCE_OPEN_RE = /<<<\s*UNTRUSTED_DATA\b/gi;

const INSTRUCTION_PHRASES: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|preceding)\s+(?:instructions?|rules?|prompts?)/gi,
    label: 'ignore-previous',
  },
  {
    pattern: /игнорируй(?:те)?\s+(?:все\s+)?(?:предыдущие|прошлые|выше)\s+(?:инструкции|правила)/gi,
    label: 'ignore-previous',
  },
  {
    pattern: /you\s+are\s+now\b/gi,
    label: 'role-switch',
  },
  {
    pattern: /ты\s+теперь\b/gi,
    label: 'role-switch',
  },
  {
    pattern: /new\s+instructions\s*:/gi,
    label: 'new-instructions',
  },
  {
    pattern: /новые\s+инструкции\s*:/gi,
    label: 'new-instructions',
  },
];

function sanitizeSource(source: string): string {
  const cleaned = source.replace(SOURCE_SAFE, '_').replace(/^_+|_+$/g, '').slice(0, 64);
  return cleaned || 'unknown';
}

function neutralizeFences(text: string): string {
  return text
    .replace(FENCE_CLOSE_RE, '‹‹‹END_UNTRUSTED_DATA›››')
    .replace(FENCE_OPEN_RE, '‹‹‹UNTRUSTED_DATA');
}

function neutralizeInstructionPhrases(text: string): string {
  return INSTRUCTION_PHRASES.reduce(
    (acc, { pattern, label }) => acc.replace(pattern, `[neutralized: ${label}]`),
    text,
  );
}

function neutralizeRoleMarkers(text: string): string {
  return text
    .replace(/^(system|assistant|developer)\s*:/gim, '[$1]')
    .replace(/<\|im_start\|>\s*system/gi, '[neutralized: im_start-system]')
    .replace(/<\/?(?:system|assistant)(?:\s[^>]*)?>/gi, '[neutralized: role-tag]');
}

export function neutralizeUntrustedText(text: string): string {
  return neutralizeRoleMarkers(neutralizeInstructionPhrases(neutralizeFences(String(text ?? ''))));
}

export function wrapUntrustedData(source: string, text: string): string {
  const body = neutralizeUntrustedText(text);
  return `${UNTRUSTED_FENCE_OPEN} source="${sanitizeSource(source)}"\n${body}\n${UNTRUSTED_FENCE_CLOSE}`;
}
