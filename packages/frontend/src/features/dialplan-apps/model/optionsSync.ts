export interface OptionSet {
  tokens: string[];
}

export function parseOptions(input: string): OptionSet {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const start = i;
    i += 1;
    if (input[i] === '(') {
      let depth = 1;
      i += 1;
      while (i < input.length && depth > 0) {
        if (input[i] === '(') depth += 1;
        else if (input[i] === ')') depth -= 1;
        i += 1;
      }
    }
    tokens.push(input.slice(start, i));
  }
  return { tokens };
}

export function serializeOptions(set: OptionSet): string {
  return (set?.tokens ?? []).join('');
}

export function isOptionsParseError(input: string): boolean {
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) return true;
    }
  }
  return depth !== 0;
}

export function toggleFlag(input: string, flag: string, enabled: boolean): string {
  const parsed = parseOptions(input);
  if (enabled) {
    if (parsed.tokens.some((token) => token === flag || token.startsWith(`${flag}(`))) {
      return serializeOptions(parsed);
    }
    return serializeOptions({ tokens: [...parsed.tokens, flag] });
  }
  return serializeOptions({
    tokens: parsed.tokens.filter((token) => token !== flag && !token.startsWith(`${flag}(`)),
  });
}

export function isFlagEnabled(tokens: string[], flag: string): boolean {
  return tokens.some((token) => token === flag || token.startsWith(`${flag}(`));
}

export function parameterizedTokens(tokens: string[], knownFlags: readonly string[]): string[] {
  return tokens.filter((token) => {
    const letter = token[0];
    const isParam = token.includes('(');
    const unknown = !knownFlags.includes(letter);
    return isParam || unknown;
  });
}
