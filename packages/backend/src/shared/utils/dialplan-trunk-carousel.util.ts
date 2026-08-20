/**
 * Linear trunk carousel (D-36).
 * One loop entry, channel-var index, CUT() over materialized lists.
 * Attempt order for random_then_failover matches the 12-01 wrap-around baseline.
 */

const DIALPLAN_UNSAFE = /[(),?\[\]{}$\\";\n\r]/g;

export type TrunkCarouselMode = 'random_then_failover' | 'sequential';

export interface TrunkCarouselEntry {
  trunk: string;
  timeout?: number | string;
  cid_mode?: 'static' | 'phonebook';
  callerid?: string;
  phonebook_uid?: number;
}

export type TrunkCarouselInput = string | TrunkCarouselEntry;

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

function asEntry(item: TrunkCarouselInput): TrunkCarouselEntry {
  if (typeof item === 'string') return { trunk: item };
  return item;
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

function phonebookLookupUrl(ctx: BuildTrunkCarouselCtx, uidExpr: string): string {
  const base = ctx.backendBaseUrl || 'http://127.0.0.1:5010/api';
  const key = ctx.dialplanApiKey ? `&api_key=${encodeURIComponent(ctx.dialplanApiKey)}` : '';
  return `${base}/internal/dialplan/phonebook-lookup?phonebook_uid=${uidExpr}${key}`;
}

function emitSingleTrunk(entry: TrunkCarouselEntry, ctx: BuildTrunkCarouselCtx): string {
  const fallbackTimeout = resolveTimeout(ctx.timeout, 60);
  const timeout = resolveTimeout(entry.timeout, fallbackTimeout);
  const trunk = sanitizeListField(entry.trunk);
  const dest = ctx.dest || '${EXTEN}';
  const opts = sanitize(ctx.options || 'tT');
  const apps: string[] = [];

  if (entry.cid_mode === 'phonebook') {
    const pbUid = sanitizeListField(String(entry.phonebook_uid ?? ''));
    const lookupUrl = phonebookLookupUrl(ctx, pbUid);
    apps.push(`Set(TC_PB=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`);
    apps.push(`ExecIf($["\${CUT(TC_PB,|,1)}" = "1"]?Set(CALLERID(num)=\${CUT(TC_PB,|,3)}))`);
  } else {
    const cid = sanitizeListField(entry.callerid);
    if (cid) apps.push(`Set(CALLERID(num)=${cid})`);
  }

  apps.push(`Dial(${trunk}/${dest},${timeout},${opts})`);
  apps.push('Return()');
  return joinDialplan(apps[0], apps.slice(1).map((app) => `n,${app}`));
}

/**
 * Build a linear Dial loop over trunks.
 * Empty list → diagnostic NoOp (next chain step still runs).
 */
export function buildTrunkCarousel(
  trunks: TrunkCarouselInput[],
  ctx: BuildTrunkCarouselCtx = {},
): string {
  const entries = (Array.isArray(trunks) ? trunks : []).map(asEntry)
    .map((item) => ({ ...item, trunk: sanitizeListField(item.trunk) }))
    .filter((item) => item.trunk);
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

  const list = entries.map((e) => e.trunk).join('|');
  const timeouts = entries.map((e) => String(resolveTimeout(e.timeout, fallbackTimeout))).join('|');
  const cidModes = entries.map((e) => (e.cid_mode === 'phonebook' ? 'phonebook' : 'static')).join('|');
  const cids = entries.map((e) => sanitizeListField(e.callerid)).join('|');
  const pbUids = entries.map((e) => sanitizeListField(String(e.phonebook_uid ?? ''))).join('|');
  const start = mode === 'sequential' ? 'Set(TC_I=1)' : `Set(TC_I=\${RAND(1,${n})})`;
  const lookupUrl = phonebookLookupUrl(ctx, '${TC_PBU}');

  const rest: string[] = [
    `n,Set(TC_TIMEOUTS=${timeouts})`,
    `n,Set(TC_CIDMODE=${cidModes})`,
    `n,Set(TC_CID=${cids})`,
    `n,Set(TC_PBUID=${pbUids})`,
    `n,Set(TC_N=${n})`,
    `n,${start}`,
    'n,Set(TC_TRIED=0)',
    'n(tc_try),Set(TC_TRUNK=${CUT(TC_LIST,|,${TC_I})})',
    'n,Set(TC_TO=${CUT(TC_TIMEOUTS,|,${TC_I})})',
    'n,Set(TC_CM=${CUT(TC_CIDMODE,|,${TC_I})})',
    'n,GotoIf($["${TC_CM}" = "phonebook"]?tc_pb)',
    'n,Set(TC_CIDV=${CUT(TC_CID,|,${TC_I})})',
    'n,ExecIf($["${TC_CIDV}" != ""]?Set(CALLERID(num)=${TC_CIDV}))',
    'n,Goto(tc_dial)',
    'n(tc_pb),Set(TC_PBU=${CUT(TC_PBUID,|,${TC_I})})',
    `n,Set(TC_PB=\${CURL(${lookupUrl}&number=\${URIENCODE(\${CALLERID(num)})})})`,
    'n,ExecIf($["${CUT(TC_PB,|,1)}" = "1"]?Set(CALLERID(num)=${CUT(TC_PB,|,3)}))',
    `n(tc_dial),Dial(\${TC_TRUNK}/${dest},\${TC_TO},${opts})`,
    'n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())',
    'n,Set(TC_I=$[${TC_I} + 1])',
    'n,ExecIf($[${TC_I} > ${TC_N}]?Set(TC_I=1))',
    'n,Set(TC_TRIED=$[${TC_TRIED} + 1])',
    'n,GotoIf($[${TC_TRIED} < ${TC_N}]?tc_try)',
    'n,Return()',
  ];

  return joinDialplan(`Set(TC_LIST=${list})`, rest);
}
