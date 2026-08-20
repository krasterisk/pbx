import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import type { ICallGroup, ICallGroupMember } from '@krasterisk/shared';

export interface GeneratedDialplanCategory {
  name: string;
  lines: string[];
}

export interface GenerateGroupDialplanOptions {
  dialOpts?: string;
  rng?: () => number;
}

const ANSWER_RETURN = 'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Return())';
const FINAL_RETURN = 'same => n,Return()';

function sortMembers(members: ICallGroupMember[]): ICallGroupMember[] {
  return [...members].sort((a, b) => a.position - b.position);
}

function memberInterface(
  member: ICallGroupMember,
  vpbx: number,
  externalContext: string,
  webrtcExtensions?: Set<string>,
): string {
  const value = AsteriskDialplanUtils.sanitizeDialplanInput(member.value);
  if (member.member_type === 'internal') {
    const webrtc = webrtcExtensions?.has(value) === true;
    return AsteriskDialplanUtils.pjsipDialTarget(value, vpbx, { webrtc });
  }
  const ctx = AsteriskDialplanUtils.sanitizeDialplanInput(externalContext);
  return `LOCAL/${value}@${ctx}`;
}

function buildDialLine(targets: string, ringTime: number, dialOpts: string): string {
  return `same => n,Dial(${targets},${ringTime},${dialOpts})`;
}

/**
 * Prefix install and rollback live in one function so restore cannot be forgotten (D-35 / T-12-14-04).
 */
function cidPrefixOps(group: ICallGroup): {
  enter: string[];
  beforeReturn: string[];
  beforeAnswerReturn: string[];
} {
  const prefix = group.cid_prefix
    ? AsteriskDialplanUtils.sanitizeDialplanInput(group.cid_prefix)
    : '';
  if (!prefix) {
    return { enter: [], beforeReturn: [], beforeAnswerReturn: [] };
  }
  return {
    enter: [
      'same => n,Set(KRSK_CID_NAME=${CALLERID(name)})',
      `same => n,Set(CALLERID(name)=${prefix} \${CALLERID(name)})`,
    ],
    beforeReturn: ['same => n,Set(CALLERID(name)=${KRSK_CID_NAME})'],
    beforeAnswerReturn: [
      'same => n,ExecIf($["${DIALSTATUS}" = "ANSWER"]?Set(CALLERID(name)=${KRSK_CID_NAME}))',
    ],
  };
}

function shuffleCopy<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

function emitRingall(
  lines: string[],
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions: Set<string> | undefined,
  dialOpts: string,
): void {
  const cid = cidPrefixOps(group);
  lines.push(...cid.enter);
  const targets = members
    .map((m) => memberInterface(m, vpbx, group.external_context, webrtcExtensions))
    .join('&');
  lines.push(buildDialLine(targets, group.ring_time, dialOpts));
  lines.push(...cid.beforeReturn);
  lines.push(FINAL_RETURN);
}

function emitHunt(
  lines: string[],
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions: Set<string> | undefined,
  dialOpts: string,
): void {
  const cid = cidPrefixOps(group);
  lines.push(...cid.enter);
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    lines.push(
      buildDialLine(
        memberInterface(member, vpbx, group.external_context, webrtcExtensions),
        member.ring_time,
        dialOpts,
      ),
    );
    if (i < members.length - 1) {
      lines.push(...cid.beforeAnswerReturn);
      lines.push(ANSWER_RETURN);
    }
  }
  lines.push(...cid.beforeReturn);
  lines.push(FINAL_RETURN);
}

function emitMemoryhunt(
  lines: string[],
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions: Set<string> | undefined,
  dialOpts: string,
): void {
  const cid = cidPrefixOps(group);
  lines.push(...cid.enter);
  for (let i = 0; i < members.length; i++) {
    const subset = members.slice(0, i + 1);
    const targets = subset
      .map((m) => memberInterface(m, vpbx, group.external_context, webrtcExtensions))
      .join('&');
    lines.push(buildDialLine(targets, members[i].ring_time, dialOpts));
    if (i < members.length - 1) {
      lines.push(...cid.beforeAnswerReturn);
      lines.push(ANSWER_RETURN);
    }
  }
  lines.push(...cid.beforeReturn);
  lines.push(FINAL_RETURN);
}

function emitRandom(
  lines: string[],
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions: Set<string> | undefined,
  dialOpts: string,
  rng: () => number,
): void {
  const shuffled = shuffleCopy(members, rng);
  const cid = cidPrefixOps(group);
  lines.push(...cid.enter);
  const first = shuffled[0];
  if (!first) {
    lines.push(...cid.beforeReturn);
    lines.push(FINAL_RETURN);
    return;
  }
  lines.push(
    buildDialLine(
      memberInterface(first, vpbx, group.external_context, webrtcExtensions),
      first.ring_time,
      dialOpts,
    ),
  );
  if (shuffled.length > 1) {
    lines.push(...cid.beforeAnswerReturn);
    lines.push(ANSWER_RETURN);
    const restTargets = shuffled
      .slice(1)
      .map((m) => memberInterface(m, vpbx, group.external_context, webrtcExtensions))
      .join('&');
    lines.push(buildDialLine(restTargets, group.ring_time, dialOpts));
  }
  lines.push(...cid.beforeReturn);
  lines.push(FINAL_RETURN);
}

export function generateGroupDialplan(
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions?: Set<string>,
  options?: GenerateGroupDialplanOptions,
): GeneratedDialplanCategory {
  const dialOpts = options?.dialOpts ?? 'tT';
  const rng = options?.rng ?? (Math as { random(): number }).random.bind(Math);
  const ctxName = normalizeTarget('group', { source: 'fixed', value: group.exten }, vpbx);
  const sorted = sortMembers(members);
  const lines: string[] = [];

  lines.push(`[${ctxName}]`);
  const transitionalInclude = `include => group_${group.uid}_${vpbx}`;
  if (transitionalInclude !== `include => ${ctxName}`) {
    lines.push(transitionalInclude);
  }
  lines.push(`exten => start,1,NoOp(Call group: ${group.name} [${group.strategy}])`);

  switch (group.strategy) {
    case 'ringall':
      emitRingall(lines, group, sorted, vpbx, webrtcExtensions, dialOpts);
      break;
    case 'hunt':
      emitHunt(lines, group, sorted, vpbx, webrtcExtensions, dialOpts);
      break;
    case 'memoryhunt':
      emitMemoryhunt(lines, group, sorted, vpbx, webrtcExtensions, dialOpts);
      break;
    case 'random':
      emitRandom(lines, group, sorted, vpbx, webrtcExtensions, dialOpts, rng);
      break;
  }

  return { name: ctxName, lines };
}
