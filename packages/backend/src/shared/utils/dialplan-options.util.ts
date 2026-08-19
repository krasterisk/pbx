export interface OptionSet {
  /** Tokens in original order: single-letter flags or parameterized chunks like U(x). */
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
