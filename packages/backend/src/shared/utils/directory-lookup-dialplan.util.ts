import type {
  CallValueSource,
  DirectoryLookupOutput,
  DirectoryValueSource,
} from '@krasterisk/shared';

export const TARGET_VARIABLE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

const RESERVED_TARGET_VARIABLES = new Set([
  'CALLERID',
  'CALLERID(num)',
  'EXTEN',
  'UNIQUEID',
]);

export function validateAction(output: { targetVariable: string }): string[] {
  const name = output?.targetVariable ?? '';
  const errors: string[] = [];
  if (!TARGET_VARIABLE_RE.test(name)) {
    errors.push('targetVariable must match ^[A-Z][A-Z0-9_]{1,63}$');
  }
  if (RESERVED_TARGET_VARIABLES.has(name) || name.startsWith('KRSK_')) {
    errors.push('targetVariable is reserved');
  }
  return errors;
}

const DIALPLAN_UNSAFE = /[(),?[\]{}$\\";\n\r]/g;

export interface CompileDirectoryLookupRequest {
  token: string;
  directoryUid: number;
  userUid: number;
  keySource: CallValueSource;
  fieldUids: number[];
  outputs?: DirectoryLookupOutput[];
  onMissing: 'keep' | 'empty' | 'skip';
  backendBaseUrl: string;
  apiKey: string;
}

export interface CompiledDirectoryLookup {
  lines: string[];
  statusVar: string;
  valueVars: Map<number, string>;
  canExecuteExpr: string;
}

export function sanitizeDialValue(input?: string): string {
  if (!input) return '';
  return input.replace(DIALPLAN_UNSAFE, '').trim();
}

export function sanitizeVariableName(input?: string): string {
  if (!input) return '';
  return input.replace(/[^A-Za-z0-9_]/g, '');
}

export function sanitizeLookupToken(token: string): string {
  const cleaned = String(token ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned || 'X';
}

export function lookupToken(actionId: unknown, suffix: string): string {
  const raw = actionId == null || String(actionId).trim() === ''
    ? suffix
    : `${actionId}${suffix}`;
  return sanitizeLookupToken(raw);
}

export function callValueSourceExpr(source: CallValueSource): string {
  switch (source.source) {
    case 'fixed':
      return sanitizeDialValue(source.value);
    case 'route_pattern':
      return '${EXTEN}';
    case 'variable':
      return `\${${sanitizeVariableName(source.name)}}`;
    case 'original_caller':
      return '${KRSK_ORIG_CALLER_NUM}';
    case 'current_caller':
      return '${CALLERID(num)}';
  }
}

export function compileDirectoryLookup(
  req: CompileDirectoryLookupRequest,
): CompiledDirectoryLookup {
  const token = sanitizeLookupToken(req.token);
  const statusVar = `KRSK_DL_${token}_STATUS`;
  const rawVar = `KRSK_DL_${token}_RAW`;
  const fieldUids = uniqueFieldUids(req.fieldUids);
  const valueVars = new Map<number, string>();
  for (const fieldUid of fieldUids) {
    valueVars.set(fieldUid, `KRSK_DL_${token}_F${fieldUid}`);
  }

  const lines: string[] = [
    `Set(${statusVar}=ERROR)`,
    `Set(${rawVar}=)`,
  ];
  for (const fieldUid of fieldUids) {
    lines.push(`Set(${valueVars.get(fieldUid)}=)`);
  }

  if (req.onMissing === 'empty') {
    for (const output of req.outputs ?? []) {
      if (validateAction(output).length) continue;
      lines.push(`Set(${output.targetVariable}=)`);
    }
  }

  const keyExpr = callValueSourceExpr(req.keySource);
  const url = [
    `${req.backendBaseUrl}/internal/dialplan/directory-lookup`,
    `?directory_uid=${req.directoryUid}`,
    `&user_uid=${req.userUid}`,
    `&key=\${URIENCODE(${keyExpr})}`,
    `&field_uids=${fieldUids.join(',')}`,
    `&api_key=${encodeURIComponent(req.apiKey ?? '')}`,
  ].join('');

  lines.push('Set(CURLOPT(conntimeout)=1)');
  lines.push('Set(CURLOPT(httptimeout)=2)');
  lines.push(`Set(${rawVar}=\${CURL(${url})})`);

  const proto = `"\${CUT(${rawVar},|,1)}" = "KDL1"`;
  lines.push(
    `ExecIf($[${proto} & "\${CUT(${rawVar},|,2)}" = "FOUND"]?Set(${statusVar}=FOUND))`,
  );
  lines.push(
    `ExecIf($[${proto} & "\${CUT(${rawVar},|,2)}" = "NOT_FOUND"]?Set(${statusVar}=NOT_FOUND))`,
  );

  fieldUids.forEach((fieldUid, index) => {
    const cutPos = index + 3;
    const valueVar = valueVars.get(fieldUid);
    lines.push(
      `ExecIf($["\${${statusVar}}" = "FOUND"]?Set(${valueVar}=\${BASE64_DECODE(\${CUT(${rawVar},|,${cutPos})})}))`,
    );
  });

  for (const output of req.outputs ?? []) {
    if (validateAction(output).length) continue;
    const valueVar = valueVars.get(output.fieldUid);
    if (!valueVar) continue;
    lines.push(
      `ExecIf($["\${${statusVar}}" = "FOUND"]?Set(${output.targetVariable}=\${${valueVar}}))`,
    );
  }

  return {
    lines,
    statusVar,
    valueVars,
    canExecuteExpr: `$["\${${statusVar}}" = "FOUND"]`,
  };
}

export function compileDirectoryValueSource(
  src: DirectoryValueSource,
  token: string,
  userUid: number,
  backendBaseUrl: string,
  apiKey: string,
): CompiledDirectoryLookup {
  return compileDirectoryLookup({
    token,
    directoryUid: src.directoryUid,
    userUid,
    keySource: src.keySource,
    fieldUids: [src.valueFieldUid],
    onMissing: src.onMissing,
    backendBaseUrl,
    apiKey,
  });
}

function uniqueFieldUids(uids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const uid of uids) {
    if (!Number.isInteger(uid) || uid < 1 || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}
