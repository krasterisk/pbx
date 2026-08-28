/**
 * Linear trunk carousel (D-36).
 * One loop entry, channel-var index, CUT() over materialized lists.
 * Attempt order for random_then_failover matches the 12-01 wrap-around baseline.
 * Directory CallerID is prefetched once per directory, keyed by original caller.
 */

import type { ITrunkCarouselItem, TrunkCallerIdSource } from '@krasterisk/shared';
import {
  compileDirectoryLookup,
  type CompiledDirectoryLookup,
} from './directory-lookup-dialplan.util';

const DIALPLAN_UNSAFE = /[(),?\[\]{}$\\";\n\r]/g;

export type TrunkCarouselMode = 'random_then_failover' | 'sequential';

export interface BuildTrunkCarouselCtx {
  mode?: string;
  timeout?: number | string;
  options?: string;
  dest?: string;
  vpbxUserUid?: number;
  backendBaseUrl?: string;
  dialplanApiKey?: string;
}

function sanitize(input?: string): string {
  if (!input) return '';
  return input.replace(DIALPLAN_UNSAFE, '').trim();
}

function sanitizeListField(input?: string): string {
  return sanitize(input).replace(/\|/g, '');
}

function asEntry(item: ITrunkCarouselItem): ITrunkCarouselItem {
  return {
    trunkId: item?.trunkId ?? '',
    timeout: item?.timeout,
    callerId: item?.callerId ?? { mode: 'static' },
  };
}

function resolveTimeout(value: number | string | undefined, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Read mode from params; never overwrite the incoming value (selector is real). */
export function resolveCarouselMode(mode?: string): TrunkCarouselMode {
  return mode === 'sequential' ? 'sequential' : 'random_then_failover';
}

function joinDialplan(head: string, rest: string[]): string {
  if (!rest.length) return head;
  return [head, ...rest.map((part) => `same => ${part}`)].join('\n');
}

function isDirectoryCaller(
  callerId: TrunkCallerIdSource,
): callerId is Extract<TrunkCallerIdSource, { mode: 'directory' }> {
  return callerId?.mode === 'directory';
}

function compileDirectoryGroups(
  entries: ITrunkCarouselItem[],
  ctx: BuildTrunkCarouselCtx,
): Map<number, CompiledDirectoryLookup> {
  const fieldsByDirectory = new Map<number, number[]>();
  for (const entry of entries) {
    if (!isDirectoryCaller(entry.callerId)) continue;
    const directoryUid = Number(entry.callerId.directoryUid);
    const fieldUid = Number(entry.callerId.valueFieldUid);
    if (!Number.isInteger(directoryUid) || directoryUid < 1) continue;
    const fields = fieldsByDirectory.get(directoryUid) ?? [];
    fields.push(fieldUid);
    fieldsByDirectory.set(directoryUid, fields);
  }

  const compiled = new Map<number, CompiledDirectoryLookup>();
  for (const [directoryUid, fieldUids] of fieldsByDirectory) {
    const uniqueSorted = [...new Set(fieldUids)]
      .filter((uid) => Number.isInteger(uid) && uid >= 1)
      .sort((a, b) => a - b);
    compiled.set(directoryUid, compileDirectoryLookup({
      token: `TC${directoryUid}`,
      directoryUid,
      userUid: ctx.vpbxUserUid ?? 0,
      keySource: { source: 'original_caller' },
      fieldUids: uniqueSorted,
      onMissing: 'keep',
      backendBaseUrl: ctx.backendBaseUrl || 'http://127.0.0.1:5010/api',
      apiKey: ctx.dialplanApiKey ?? '',
    }));
  }
  return compiled;
}

function directorySlots(
  callerId: TrunkCallerIdSource,
  groups: Map<number, CompiledDirectoryLookup>,
): { valueVar: string; statusVar: string } {
  if (!isDirectoryCaller(callerId)) return { valueVar: '', statusVar: '' };
  const compiled = groups.get(Number(callerId.directoryUid));
  if (!compiled) return { valueVar: '', statusVar: '' };
  return {
    valueVar: compiled.valueVars.get(Number(callerId.valueFieldUid)) ?? '',
    statusVar: compiled.statusVar,
  };
}

function emitCallerIdApply(
  callerId: TrunkCallerIdSource,
  groups: Map<number, CompiledDirectoryLookup>,
): string[] {
  const apps = ['Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})'];
  if (isDirectoryCaller(callerId)) {
    const { valueVar, statusVar } = directorySlots(callerId, groups);
    if (valueVar && statusVar) {
      apps.push(
        `ExecIf($["\${${statusVar}}" = "FOUND" & "\${${valueVar}}" != ""]?Set(CALLERID(num)=\${${valueVar}}))`,
      );
    }
    return apps;
  }
  const cid = sanitizeListField(callerId.mode === 'static' ? callerId.value : '');
  if (cid) apps.push(`Set(CALLERID(num)=${cid})`);
  return apps;
}

function emitSingleTrunk(entry: ITrunkCarouselItem, ctx: BuildTrunkCarouselCtx): string {
  const fallbackTimeout = resolveTimeout(ctx.timeout, 60);
  const timeout = resolveTimeout(entry.timeout, fallbackTimeout);
  const trunkId = sanitizeListField(entry.trunkId);
  const dest = ctx.dest || '${EXTEN}';
  const opts = sanitize(ctx.options || 'tT');
  const groups = compileDirectoryGroups([entry], ctx);
  const apps: string[] = [];
  for (const compiled of groups.values()) {
    apps.push(...compiled.lines);
  }
  apps.push(...emitCallerIdApply(entry.callerId, groups));
  apps.push(`Dial(PJSIP/${trunkId}/${dest},${timeout},${opts})`);
  apps.push('Return()');
  return joinDialplan(apps[0], apps.slice(1).map((app) => `n,${app}`));
}

/**
 * Build a linear Dial loop over trunks.
 * Empty list → diagnostic NoOp (next chain step still runs).
 */
export function buildTrunkCarousel(
  trunks: ITrunkCarouselItem[],
  ctx: BuildTrunkCarouselCtx = {},
): string {
  const entries = (Array.isArray(trunks) ? trunks : []).map(asEntry)
    .map((item) => ({ ...item, trunkId: sanitizeListField(item.trunkId) }))
    .filter((item) => item.trunkId);
  if (!entries.length) {
    return 'NoOp(Empty trunk carousel)';
  }
  if (entries.length === 1) {
    return emitSingleTrunk(entries[0], ctx);
  }

  const mode = resolveCarouselMode(ctx.mode);
  const fallbackTimeout = resolveTimeout(ctx.timeout, 60);
  const dest = ctx.dest || '${EXTEN}';
  const opts = sanitize(ctx.options || 'tT');
  const n = entries.length;
  const groups = compileDirectoryGroups(entries, ctx);

  const list = entries.map((e) => e.trunkId).join('|');
  const timeouts = entries.map((e) => String(resolveTimeout(e.timeout, fallbackTimeout))).join('|');
  const cidModes = entries.map((e) => (isDirectoryCaller(e.callerId) ? 'directory' : 'static')).join('|');
  const cids = entries.map((e) => (
    isDirectoryCaller(e.callerId) ? '' : sanitizeListField(e.callerId.mode === 'static' ? e.callerId.value : '')
  )).join('|');
  const cidVars = entries.map((e) => directorySlots(e.callerId, groups).valueVar).join('|');
  const cidStatus = entries.map((e) => directorySlots(e.callerId, groups).statusVar).join('|');
  const start = mode === 'sequential' ? 'Set(TC_I=1)' : `Set(TC_I=\${RAND(1,${n})})`;

  const rest: string[] = [];
  for (const compiled of groups.values()) {
    for (const line of compiled.lines) {
      rest.push(`n,${line}`);
    }
  }
  rest.push(
    `n,Set(TC_TIMEOUTS=${timeouts})`,
    `n,Set(TC_CIDMODE=${cidModes})`,
    `n,Set(TC_CID=${cids})`,
    `n,Set(TC_CIDVAR=${cidVars})`,
    `n,Set(TC_CIDST=${cidStatus})`,
    `n,Set(TC_N=${n})`,
    `n,${start}`,
    'n,Set(TC_TRIED=0)',
    'n(tc_try),Set(TC_TRUNK_ID=${CUT(TC_LIST,|,${TC_I})})',
    'n,Set(TC_TIMEOUT=${CUT(TC_TIMEOUTS,|,${TC_I})})',
    'n,Set(CALLERID(num)=${KRSK_ORIG_CALLER_NUM})',
    'n,Set(TC_CM=${CUT(TC_CIDMODE,|,${TC_I})})',
    'n,GotoIf($["${TC_CM}" = "directory"]?tc_dir)',
    'n,Set(TC_CIDV=${CUT(TC_CID,|,${TC_I})})',
    'n,ExecIf($["${TC_CIDV}" != ""]?Set(CALLERID(num)=${TC_CIDV}))',
    'n,Goto(tc_dial)',
    'n(tc_dir),Set(TC_VV=${CUT(TC_CIDVAR,|,${TC_I})})',
    'n,Set(TC_ST=${CUT(TC_CIDST,|,${TC_I})})',
    'n,ExecIf($["${${TC_ST}}" = "FOUND" & "${${TC_VV}}" != ""]?Set(CALLERID(num)=${${TC_VV}}))',
    `n(tc_dial),Dial(PJSIP/\${TC_TRUNK_ID}/${dest},\${TC_TIMEOUT},${opts})`,
    'n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
    'n,Set(TC_I=$[${TC_I} + 1])',
    'n,ExecIf($[${TC_I} > ${TC_N}]?Set(TC_I=1))',
    'n,Set(TC_TRIED=$[${TC_TRIED} + 1])',
    'n,GotoIf($[${TC_TRIED} < ${TC_N}]?tc_try)',
    'n,Return()',
  );

  return joinDialplan(`Set(TC_LIST=${list})`, rest);
}
