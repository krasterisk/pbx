import type { CallValueSource } from '@krasterisk/shared';
import {
  callValueSourceExpr,
  compileDirectoryLookup,
  validateAction,
  type CompileDirectoryLookupRequest,
} from './directory-lookup-dialplan.util';

const BASE_REQ: CompileDirectoryLookupRequest = {
  token: 'A3',
  directoryUid: 7,
  userUid: 42,
  keySource: { source: 'original_caller' },
  fieldUids: [17, 18],
  outputs: [{ fieldUid: 17, targetVariable: 'CUSTOMER_NAME' }],
  onMissing: 'keep',
  backendBaseUrl: 'http://backend.test/api',
  apiKey: 'test-key',
};

function compile(overrides: Partial<CompileDirectoryLookupRequest> = {}) {
  return compileDirectoryLookup({ ...BASE_REQ, ...overrides });
}

const CALL_VALUE_SOURCES: CallValueSource[] = [
  { source: 'fixed', value: '79001112233' },
  { source: 'route_pattern' },
  { source: 'variable', name: 'CRM_KEY' },
  { source: 'original_caller' },
  { source: 'current_caller' },
];

describe('compileDirectoryLookup', () => {
  it('emits KDL1 URL, private vars, and BASE64_DECODE without PB_', () => {
    const compiled = compile();
    const text = compiled.lines.join('\n');

    expect(text).toContain('key=${URIENCODE(${KRSK_ORIG_CALLER_NUM})}');
    expect(text).toContain('field_uids=17,18');
    expect(text).toContain('BASE64_DECODE');
    expect(text).not.toContain('PB_');
    expect(compiled.valueVars.get(17)).toBe('KRSK_DL_A3_F17');
    expect(compiled.valueVars.get(18)).toBe('KRSK_DL_A3_F18');
    expect(compiled.statusVar).toBe('KRSK_DL_A3_STATUS');
    expect(text).toContain('/internal/dialplan/directory-lookup?');
    expect(text).toContain('directory_uid=7');
    expect(text).toContain('user_uid=42');
    expect(text).toContain('api_key=test-key');
  });

  it.each(CALL_VALUE_SOURCES)(
    'only current_caller emits CALLERID(num) for %j',
    (keySource) => {
      const compiled = compile({ keySource });
      const text = compiled.lines.join('\n');
      if (keySource.source === 'current_caller') {
        expect(text).toContain('${CALLERID(num)}');
        expect(callValueSourceExpr(keySource)).toBe('${CALLERID(num)}');
      } else {
        expect(text).not.toContain('${CALLERID(num)}');
        expect(callValueSourceExpr(keySource)).not.toContain('CALLERID');
      }
      expect(text).toContain('Set(CURLOPT(conntimeout)=1)');
      expect(text).toContain('Set(CURLOPT(httptimeout)=2)');
    },
  );

  it('places CURLOPT timeouts immediately before the single CURL and has no retry', () => {
    const compiled = compile();
    const text = compiled.lines.join('\n');
    const connIdx = compiled.lines.findIndex((line) => line === 'Set(CURLOPT(conntimeout)=1)');
    const httpIdx = compiled.lines.findIndex((line) => line === 'Set(CURLOPT(httptimeout)=2)');
    const curlIdx = compiled.lines.findIndex((line) => line.includes('${CURL('));
    expect(connIdx).toBeGreaterThan(-1);
    expect(httpIdx).toBe(connIdx + 1);
    expect(curlIdx).toBe(httpIdx + 1);
    expect((text.match(/\$\{CURL\(/g) ?? []).length).toBe(1);
    expect(text).not.toMatch(/retry|tryagain|Goto\(.*retry/i);
  });

  it('initializes status to ERROR and accepts FOUND/NOT_FOUND only when field 1 is KDL1', () => {
    const text = compile().lines.join('\n');
    expect(text).toContain('Set(KRSK_DL_A3_STATUS=ERROR)');
    expect(text.indexOf('Set(KRSK_DL_A3_STATUS=ERROR)')).toBeLessThan(text.indexOf('${CURL('));
    expect(text).toContain('"${CUT(KRSK_DL_A3_RAW,|,1)}" = "KDL1"');
    expect(text).toContain('"${CUT(KRSK_DL_A3_RAW,|,2)}" = "FOUND"');
    expect(text).toContain('"${CUT(KRSK_DL_A3_RAW,|,2)}" = "NOT_FOUND"');
  });

  it('decodes requested fields only on FOUND so pipes, Unicode, commas, line breaks, and empty values survive', () => {
    const text = compile().lines.join('\n');
    expect(text).toContain(
      'ExecIf($["${KRSK_DL_A3_STATUS}" = "FOUND"]?Set(KRSK_DL_A3_F17=${BASE64_DECODE(${CUT(KRSK_DL_A3_RAW,|,3)})}))',
    );
    expect(text).toContain(
      'ExecIf($["${KRSK_DL_A3_STATUS}" = "FOUND"]?Set(KRSK_DL_A3_F18=${BASE64_DECODE(${CUT(KRSK_DL_A3_RAW,|,4)})}))',
    );

    const values = ['a|b', 'привет', 'a,b', 'line1\nline2', ''];
    const encoded = values.map((value) => Buffer.from(value, 'utf8').toString('base64'));
    const line = ['KDL1', 'FOUND', ...encoded].join('|');
    const decoded = line.split('|').slice(2).map((part) => Buffer.from(part, 'base64').toString('utf8'));
    expect(decoded).toEqual(values);
  });

  it('keep assigns mapped targets only on FOUND', () => {
    const text = compile({ onMissing: 'keep' }).lines.join('\n');
    expect(text).toContain(
      'ExecIf($["${KRSK_DL_A3_STATUS}" = "FOUND"]?Set(CUSTOMER_NAME=${KRSK_DL_A3_F17}))',
    );
    expect(text).not.toContain('Set(CUSTOMER_NAME=)');
  });

  it('empty clears mapped targets before CURL', () => {
    const compiled = compile({ onMissing: 'empty' });
    const text = compiled.lines.join('\n');
    expect(text.indexOf('Set(CUSTOMER_NAME=)')).toBeGreaterThan(-1);
    expect(text.indexOf('Set(CUSTOMER_NAME=)')).toBeLessThan(text.indexOf('${CURL('));
    expect(compiled.canExecuteExpr).toContain('KRSK_DL_A3_STATUS');
  });

  it('skip exposes a FOUND guard and does not leak prior private values', () => {
    const compiled = compile({ onMissing: 'skip', outputs: undefined });
    expect(compiled.canExecuteExpr).toBe('$["${KRSK_DL_A3_STATUS}" = "FOUND"]');
    const text = compiled.lines.join('\n');
    expect(text).toContain('Set(KRSK_DL_A3_F17=)');
    expect(text).toContain('Set(KRSK_DL_A3_F18=)');
    expect(text).toContain('Set(KRSK_DL_A3_RAW=)');
  });
});

describe('validateAction target variables', () => {
  it('accepts CUSTOMER_NAME and rejects reserved or malformed names', () => {
    expect(validateAction({ targetVariable: 'CUSTOMER_NAME' })).toHaveLength(0);
    expect(validateAction({ targetVariable: 'CALLERID' })).not.toHaveLength(0);
    expect(validateAction({ targetVariable: 'CALLERID(num)' })).not.toHaveLength(0);
    expect(validateAction({ targetVariable: 'EXTEN' })).not.toHaveLength(0);
    expect(validateAction({ targetVariable: 'UNIQUEID' })).not.toHaveLength(0);
    expect(validateAction({ targetVariable: 'KRSK_SECRET' })).not.toHaveLength(0);
    expect(validateAction({ targetVariable: 'bad-name' })).not.toHaveLength(0);
  });
});
