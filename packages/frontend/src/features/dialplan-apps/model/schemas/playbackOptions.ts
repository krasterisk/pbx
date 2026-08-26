import type { IMediaOptions, MediaMixMode } from '@krasterisk/shared';

export function parseMediaOptionsObject(input: unknown): IMediaOptions {
  if (!input) return {};
  if (typeof input === 'object' && !Array.isArray(input)) {
    return input as IMediaOptions;
  }
  if (typeof input !== 'string') return {};
  const result: IMediaOptions = {};
  const rawParts: string[] = [];
  let i = 0;
  while (i < input.length) {
    let end = i + 1;
    if (input[end] === '(') {
      let depth = 1;
      end += 1;
      while (end < input.length && depth > 0) {
        if (input[end] === '(') depth += 1;
        else if (input[end] === ')') depth -= 1;
        end += 1;
      }
    }
    const token = input.slice(i, end);
    i = end;
    if (token === 'say' || token === 'mix') {
      result.mixMode = token as MediaMixMode;
      continue;
    }
    if (token === 'n' || token === 'noanswer') {
      result.noanswer = true;
      continue;
    }
    if (token === 's' || token === 'skip') {
      result.skip = true;
      continue;
    }
    if (token === 'p') {
      result.p = true;
      continue;
    }
    rawParts.push(token);
  }
  if (rawParts.length) result.raw = rawParts.join('');
  return result;
}

export function serializeMediaOptionsObject(opts: IMediaOptions): string {
  const tokens: string[] = [];
  if (opts.noanswer) tokens.push('n');
  if (opts.skip) tokens.push('s');
  if (opts.p) tokens.push('p');
  if (opts.mixMode) tokens.push(opts.mixMode);
  if (opts.raw) tokens.push(opts.raw);
  return tokens.join('');
}
