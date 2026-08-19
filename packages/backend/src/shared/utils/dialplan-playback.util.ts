import type { IMediaOptions, IPlaybackParams, PlaybackMode } from '@krasterisk/shared';

export interface EmitPlaybackCtx {
  vpbxUserUid: number;
}

const SANITIZE_DP = /[(),?\[\]{}$\\";\n\r]/g;

function sanitizeDialplanInput(input?: string): string {
  if (!input) return '';
  return input.replace(SANITIZE_DP, '').trim();
}

function sanitizeFilePath(input?: string): string {
  if (!input) return '';
  return input
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/\0/g, '')
    .trim();
}

function sanitizeLang(input?: string): string {
  const raw = sanitizeDialplanInput(input);
  if (!/^[A-Za-z]{1,8}(?:-[A-Za-z]{1,8})?$/.test(raw) || raw.length > 8) return '';
  return raw;
}

function resolveFilenames(params: IPlaybackParams): string[] {
  const raw = params.files ?? params.file ?? '';
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((name) => sanitizeFilePath(String(name ?? '')));
}

function soundPath(uid: number, file: string): string {
  return `/usr/records/${uid}/sounds/${file}`;
}

function parseOptions(opts?: IMediaOptions | string): IMediaOptions {
  if (!opts) return {};
  if (typeof opts !== 'string') return opts;
  const result: IMediaOptions = {};
  const rawParts: string[] = [];
  let i = 0;
  while (i < opts.length) {
    let end = i + 1;
    if (opts[end] === '(') {
      let depth = 1;
      end += 1;
      while (end < opts.length && depth > 0) {
        if (opts[end] === '(') depth += 1;
        else if (opts[end] === ')') depth -= 1;
        end += 1;
      }
    }
    const token = opts.slice(i, end);
    i = end;
    if (token === 'say' || token === 'mix') {
      result.mixMode = token;
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

function optionString(opts: IMediaOptions, mode: PlaybackMode): string {
  const tokens: string[] = [];
  if (mode === 'menu') {
    if (opts.noanswer) tokens.push('n');
    if (opts.skip) tokens.push('s');
  } else {
    if (opts.noanswer) tokens.push('noanswer');
    if (opts.skip) tokens.push('skip');
    if (mode === 'control' && opts.p) tokens.push('p');
  }
  if (opts.mixMode) tokens.push(opts.mixMode);
  if (opts.raw) tokens.push(sanitizeDialplanInput(opts.raw));
  return tokens.join('');
}

function emitDigitExit(digit: string, dest: string): string {
  const safeDigit = String(digit ?? '').replace(/[^0-9*#A-D]/g, '');
  const safeDest = String(dest ?? '').replace(/[?\[\]{}$\\";\n\r]/g, '').trim();
  return `GotoIf($["\${EXTEN}" = "${safeDigit}"]?${safeDest})`;
}

function assertMode(mode: unknown): PlaybackMode {
  if (mode === 'plain' || mode === 'control' || mode === 'menu') return mode;
  return 'plain';
}

/**
 * D-51/D-52: one user action, three Asterisk apps.
 * Line order is fixed: Progress() → Set(CHANNEL(language)=…) → app.
 */
export function emitPlayback(params: IPlaybackParams, ctx: EmitPlaybackCtx): string {
  const mode = assertMode(params.mode);
  const files = resolveFilenames(params);
  const path = files.map((file) => soundPath(ctx.vpbxUserUid, file)).join('&');
  const opts = parseOptions(params.options);
  const optStr = optionString(opts, mode);
  const lang = sanitizeLang(params.langoverride);
  const lines: string[] = [];

  if (opts.noanswer) lines.push('Progress()');
  if (lang && mode !== 'menu') {
    lines.push(`Set(CHANNEL(language)=${lang})`);
  }

  switch (mode) {
    case 'plain':
      lines.push(optStr ? `Playback(${path},${optStr})` : `Playback(${path})`);
      break;
    case 'control':
      lines.push(optStr
        ? `ControlPlayback(${path},3000,#,*,,,,${optStr})`
        : `ControlPlayback(${path})`);
      break;
    case 'menu': {
      const bgArgs = [path];
      if (optStr || lang) bgArgs.push(optStr);
      if (lang) bgArgs.push(lang);
      lines.push(`BackGround(${bgArgs.join(',')})`);
      if (params.digitExit && params.digit && params.digitExitDest) {
        lines.push(emitDigitExit(String(params.digit), String(params.digitExitDest)));
      }
      break;
    }
    default: {
      const _never: never = mode;
      return _never;
    }
  }

  return lines.join('\nsame => n,');
}
