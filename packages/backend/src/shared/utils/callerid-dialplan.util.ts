import { createHash } from 'node:crypto';
import {
  callerIdV2Errors,
  type ICallerIdV2Params,
  type CallerIdField,
  type CallValueSource,
} from '@krasterisk/shared';
import { compileDirectoryLookup, lookupToken } from './directory-lookup-dialplan.util';
import { compileDialTargetRewrite, DIAL_OK_VAR } from './dialplan-number.util';
import { buildCurlCall } from './dialplan-curl.util';

const v = (name: string) => '${' + name + '}';
const encoded = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const literal = (value: string) => '${BASE64_DECODE(' + encoded(value) + ')}';
export interface CallerIdCompileContext {
  tenant: number;
  actionId: string;
  scope: string;
  backendBaseUrl: string;
  apiKey: string;
}
function keyExpr(key: CallValueSource): string {
  if (key.source === 'original_caller') return v('KRSK_ORIG_CALLER_NUM');
  if (key.source === 'current_caller') return v('KRSK_CID2_IN_NUM');
  if (key.source === 'route_pattern') return v('KRSK_CID2_IN_B');
  if (key.source === 'fixed') return literal(key.value);
  return key.source === 'variable' ? v(key.name) : '';
}
/** New pool state is scoped to tenant/owner/step/content. All read/update operations are locked. */
function poolLines(
  poolVar: string,
  pick: 'random' | 'round_robin',
  target: string,
  status: string,
  ctx: CallerIdCompileContext,
): string[] {
  const identity = createHash('sha256')
    .update(ctx.scope + ':' + ctx.actionId)
    .digest('hex')
    .slice(0, 24);
  const pool = v(poolVar);
  const state = 'krs/cid2/' + ctx.tenant + '/' + identity + '/' + v('KRSK_CID2_HASH');
  return [
    'Set(KRSK_CID2_COUNT=${FIELDQTY(' + poolVar + ',|)})',
    'Set(KRSK_CID2_HASH=${SHA1(' + pool + ')})',
    'Set(KRSK_CID2_KEY=' + state + ')',
    'Set(KRSK_CID2_LOCK=${LOCK(' + v('KRSK_CID2_KEY') + ')})',
    'Set(' + status + '=ERROR)',
    'GotoIf($[' + v('KRSK_CID2_LOCK') + ' != 1]?cid2_pool_done_' + identity + ')',
    'Set(KRSK_CID2_I=${DB(' + v('KRSK_CID2_KEY') + '/index)})',
    'ExecIf($["' + v('KRSK_CID2_I') + '" = ""]?Set(KRSK_CID2_I=0))',
    'Set(KRSK_CID2_LAST=${DB(' + v('KRSK_CID2_KEY') + '/last)})',
    pick === 'round_robin'
      ? 'Set(KRSK_CID2_I=$[' + v('KRSK_CID2_I') + ' % ' + v('KRSK_CID2_COUNT') + ' + 1])'
      : 'Set(KRSK_CID2_I=${RAND(1,' + v('KRSK_CID2_COUNT') + ')})',
    ...(pick === 'random'
      ? [
          'ExecIf($[' +
            v('KRSK_CID2_COUNT') +
            ' > 1 & "${CUT(' +
            poolVar +
            ',|,' +
            v('KRSK_CID2_I') +
            ')}" = "' +
            v('KRSK_CID2_LAST') +
            '"]?Set(KRSK_CID2_I=$[' +
            v('KRSK_CID2_I') +
            ' % ' +
            v('KRSK_CID2_COUNT') +
            ' + 1]))',
        ]
      : []),
    'Set(' + target + '=${CUT(' + poolVar + ',|,' + v('KRSK_CID2_I') + ')})',
    'Set(DB(' + v('KRSK_CID2_KEY') + '/index)=' + v('KRSK_CID2_I') + ')',
    'Set(DB(' + v('KRSK_CID2_KEY') + '/last)=' + v(target) + ')',
    'Set(KRSK_CID2_UNLOCK=${UNLOCK(' + v('KRSK_CID2_KEY') + ')})',
    'Set(' + status + '=FOUND)',
    'NoOp(cid2_pool_done_' + identity + ')',
  ].map((line) =>
    line.startsWith('NoOp(cid2_pool_done_')
      ? '(' + 'cid2_pool_done_' + identity + '),NoOp(Caller ID pool completed)'
      : line,
  );
}
export function compileCallerIdV2(params: ICallerIdV2Params, ctx: CallerIdCompileContext): string {
  const errors = callerIdV2Errors(params);
  if (errors.length) throw new Error(errors.join(', '));
  const lines = [
    'ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_NUM=${CALLERID(num)}))',
    'ExecIf($["${KRSK_ORIG_CALLER_CAPTURED}" != "1"]?Set(__KRSK_ORIG_CALLER_CAPTURED=1))',
    'Set(KRSK_CID2_IN_NUM=${CALLERID(num)})',
    'Set(KRSK_CID2_IN_NAME=${CALLERID(name)})',
    'Set(KRSK_CID2_IN_B=${EXTEN})',
    'Set(KRSK_CID2_ABORT=0)',
  ];
  for (const target of ['number', 'name'] as const) {
    const field = params[target];
    const tag = target === 'number' ? 'NUM' : 'NAME';
    const candidate = 'KRSK_CID2_OUT_' + tag;
    const status = 'KRSK_CID2_STATUS_' + tag;
    const input = 'KRSK_CID2_IN_' + tag;
    lines.push('Set(' + candidate + '=' + v(input) + ')', 'Set(' + status + '=FOUND)');
    if (!field) continue;
    compileField(field, target, candidate, status, input, ctx, lines);
    if (target === 'number' && !field.clear) {
      lines.push('ExecIf($[${LEN(' + v(candidate) + ')} > 79]?Set(' + status + '=ERROR))');
      lines.push('Set(KRSK_CID2_ENCODED=${BASE64_ENCODE(' + v(candidate) + ')})');
      lines.push(
        'Set(KRSK_CID2_FILTERED=${BASE64_ENCODE(${FILTER(0-9+*#,' + v(candidate) + ')})})',
      );
      lines.push(
        'ExecIf($["' +
          v(status) +
          '" = "FOUND" & "' +
          v('KRSK_CID2_ENCODED') +
          '" != "' +
          v('KRSK_CID2_FILTERED') +
          '"]?Set(' +
          status +
          '=ERROR))',
      );
    }
    if (field.rewrite && target === 'number') {
      const compiled = compileDialTargetRewrite(v(candidate), field.rewrite, 'phone');
      if (compiled.usedRewrite) {
        // Invalid/missing candidates never enter the number rewrite engine.
        lines.push(
          'GotoIf($["' +
            v(status) +
            '" != "FOUND"]?cid2_rewrite_' +
            lookupToken(ctx.actionId, 'DONE') +
            ')',
        );
        const rewriteLines = compiled.lines.map((line) =>
          line.replace(
            /\$\{LEN\((KRSK_DIAL_[A-Z_]+)\)\}/g,
            (_match, name) => '${LEN(${' + name + '})}',
          ),
        );
        lines.push(
          ...rewriteLines,
          'ExecIf($["' +
            v(DIAL_OK_VAR) +
            '" = "1"]?Set(' +
            candidate +
            '=' +
            compiled.destExpr +
            '))',
          'ExecIf($["' + v(DIAL_OK_VAR) + '" != "1"]?Set(' + status + '=ERROR))',
          '(cid2_rewrite_' +
            lookupToken(ctx.actionId, 'DONE') +
            '),NoOp(Caller ID number rewrite completed)',
        );
      }
    }
    if (target === 'number')
      lines.push('ExecIf($[${LEN(' + v(candidate) + ')} > 79]?Set(' + status + '=ERROR))');
    applyPolicy(field, candidate, status, input, lines);
  }
  lines.push(
    'ExecIf($["${KRSK_CID2_ABORT}" = "1"]?Hangup(21))',
    'Set(CALLERID(num)=${KRSK_CID2_OUT_NUM})',
    'Set(CALLERID(name)=${KRSK_CID2_OUT_NAME})',
  );
  if (params.name)
    lines.push('ExecIf($["${KRSK_CID2_STATUS_NAME}" = "FOUND"]?Set(CALLERID(name-charset)=utf8))');
  return lines
    .map((line, index) =>
      index === 0 ? line : 'same => n' + (line.startsWith('(') ? line : ',' + line),
    )
    .join('\n');
}
function applyPolicy(
  field: CallerIdField,
  candidate: string,
  status: string,
  input: string,
  lines: string[],
) {
  const missing = field.onMissing ?? 'keep';
  if (missing === 'hangup')
    lines.push('ExecIf($["' + v(status) + '" = "NOT_FOUND"]?Set(KRSK_CID2_ABORT=1))');
  lines.push(
    'ExecIf($["' +
      v(status) +
      '" = "NOT_FOUND"]?Set(' +
      candidate +
      '=' +
      (missing === 'empty' ? '' : v(input)) +
      '))',
  );
  if (field.onError === 'hangup')
    lines.push('ExecIf($["' + v(status) + '" = "ERROR"]?Set(KRSK_CID2_ABORT=1))');
  lines.push('ExecIf($["' + v(status) + '" = "ERROR"]?Set(' + candidate + '=' + v(input) + '))');
}
function compileField(
  field: CallerIdField,
  target: 'number' | 'name',
  candidate: string,
  status: string,
  input: string,
  ctx: CallerIdCompileContext,
  lines: string[],
) {
  const source = field.source;
  if (field.clear) {
    lines.push('Set(' + candidate + '=)');
    return;
  }
  if (source.source === 'fixed') lines.push('Set(' + candidate + '=' + literal(source.value) + ')');
  if (source.source === 'variable') lines.push('Set(' + candidate + '=' + v(source.name) + ')');
  if (source.source === 'directory') {
    const compiled = compileDirectoryLookup({
      token: lookupToken(ctx.actionId, target === 'number' ? 'CID2N' : 'CID2NAME'),
      directoryUid: source.directoryUid,
      userUid: ctx.tenant,
      keySource: source.keySource,
      fieldUids: [source.valueFieldUid],
      onMissing: 'keep',
      keyExpression: keyExpr(source.keySource),
      backendBaseUrl: ctx.backendBaseUrl,
      apiKey: ctx.apiKey,
    });
    lines.push(
      ...compiled.lines,
      'Set(' + status + '=' + v(compiled.statusVar) + ')',
      'ExecIf($["' +
        v(status) +
        '" = "FOUND"]?Set(' +
        candidate +
        '=' +
        v(compiled.valueVars.get(source.valueFieldUid)!) +
        '))',
    );
  }
  if (source.source === 'number_list') {
    lines.push('Set(KRSK_CID2_KEY_INPUT=' + keyExpr(source.keySource) + ')');
    const curl = buildCurlCall(
      'callerid-list',
      { list_uid: String(source.listUid), pick: source.pick, key: v('KRSK_CID2_KEY_INPUT') },
      {
        baseUrl: ctx.backendBaseUrl,
        apiKey: ctx.apiKey,
        vpbxUserUid: ctx.tenant,
        resultVar: 'KRSK_CID2_LIST_RAW',
        timeoutSec: 2,
      },
    );
    lines.push(
      ...curl.split('\nsame => n,'),
      'Set(' + status + '=ERROR)',
      'Set(KRSK_CID2_PROTOCOL=${BASE64_ENCODE(${CUT(KRSK_CID2_LIST_RAW,|,1)})})',
      'Set(KRSK_CID2_REMOTE_STATUS=${BASE64_ENCODE(${CUT(KRSK_CID2_LIST_RAW,|,2)})})',
      'ExecIf($["${KRSK_CID2_PROTOCOL}" = "S0NJRDI=" & "${KRSK_CID2_REMOTE_STATUS}" = "Rk9VTkQ="]?Set(' +
        status +
        '=FOUND))',
      'ExecIf($["${KRSK_CID2_PROTOCOL}" = "S0NJRDI=" & "${KRSK_CID2_REMOTE_STATUS}" = "Tk9UX0ZPVU5E"]?Set(' +
        status +
        '=NOT_FOUND))',
      'ExecIf($["' +
        v(status) +
        '" = "FOUND"]?Set(' +
        candidate +
        '=${BASE64_DECODE(${CUT(KRSK_CID2_LIST_RAW,|,3)})}))',
    );
    if (source.pick === 'random' || source.pick === 'round_robin') {
      const end = 'cid2_list_' + lookupToken(ctx.actionId, 'DONE');
      lines.push(
        'GotoIf($["' + v(status) + '" != "FOUND"]?' + end + ')',
        'Set(KRSK_CID2_POOL=' + v(candidate) + ')',
        ...poolLines('KRSK_CID2_POOL', source.pick, candidate, status, ctx),
        '(' + end + '),NoOp(Caller ID list completed)',
      );
    }
  }
  if (source.source === 'pool') {
    lines.push(
      'Set(KRSK_CID2_POOL=' + source.numbers.join('|') + ')',
      ...poolLines('KRSK_CID2_POOL', source.pick, candidate, status, ctx),
    );
  }
  // Compare base64, not text, so quotes and expression characters remain data.
  if (source.source !== 'current')
    lines.push(
      'Set(KRSK_CID2_EMPTY=${BASE64_ENCODE(' + v(candidate) + ')})',
      'ExecIf($["' +
        v(status) +
        '" = "FOUND" & "${KRSK_CID2_EMPTY}" = ""]?Set(' +
        status +
        '=NOT_FOUND))',
    );
  if (target === 'name' && field.rewrite) {
    const end = 'cid2_name_' + lookupToken(ctx.actionId, 'DONE');
    lines.push('GotoIf($["' + v(status) + '" != "FOUND"]?' + end + ')');
    lines.push(
      ...buildCurlCall(
        'callerid-name',
        { value: v(candidate), rewrite: encoded(JSON.stringify(field.rewrite)) },
        {
          baseUrl: ctx.backendBaseUrl,
          apiKey: ctx.apiKey,
          vpbxUserUid: ctx.tenant,
          resultVar: 'KRSK_CID2_NAME_RAW',
          timeoutSec: 2,
        },
      ).split('\nsame => n,'),
    );
    lines.push(
      'Set(' + status + '=ERROR)',
      'Set(KRSK_CID2_PROTOCOL=${BASE64_ENCODE(${CUT(KRSK_CID2_NAME_RAW,|,1)})})',
      'Set(KRSK_CID2_REMOTE_STATUS=${BASE64_ENCODE(${CUT(KRSK_CID2_NAME_RAW,|,2)})})',
      'ExecIf($["${KRSK_CID2_PROTOCOL}" = "S0NJRDI=" & "${KRSK_CID2_REMOTE_STATUS}" = "Rk9VTkQ="]?Set(' +
        status +
        '=FOUND))',
      'ExecIf($["' +
        v(status) +
        '" = "FOUND"]?Set(' +
        candidate +
        '=${BASE64_DECODE(${CUT(KRSK_CID2_NAME_RAW,|,3)})}))',
      '(' + end + '),NoOp(Caller ID name rewrite completed)',
    );
  }
}
