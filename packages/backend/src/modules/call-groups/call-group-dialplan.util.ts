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

function maybeCidPrefix(lines: string[], group: ICallGroup): void {
  if (group.cid_prefix) {
    const prefix = AsteriskDialplanUtils.sanitizeDialplanInput(group.cid_prefix);
    if (prefix) {
      lines.push(`same => n,Set(CALLERID(name)=${prefix} \${CALLERID(name)})`);
    }
  }
}

function emitRingall(
  lines: string[],
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions: Set<string> | undefined,
  dialOpts: string,
): void {
  maybeCidPrefix(lines, group);
  const targets = members
    .map((m) => memberInterface(m, vpbx, group.external_context, webrtcExtensions))
    .join('&');
  lines.push(buildDialLine(targets, group.ring_time, dialOpts));
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
  maybeCidPrefix(lines, group);
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
      lines.push(ANSWER_RETURN);
    }
  }
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
  maybeCidPrefix(lines, group);
  for (let i = 0; i < members.length; i++) {
    const subset = members.slice(0, i + 1);
    const targets = subset
      .map((m) => memberInterface(m, vpbx, group.external_context, webrtcExtensions))
      .join('&');
    lines.push(buildDialLine(targets, members[i].ring_time, dialOpts));
    if (i < members.length - 1) {
      lines.push(ANSWER_RETURN);
    }
  }
  lines.push(FINAL_RETURN);
}

function emitRandom(
  lines: string[],
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions: Set<string> | undefined,
  dialOpts: string,
): void {
  // v1 simplification (RESEARCH A1): random first member, then remaining in order — not full N! shuffle.
  const n = members.length;
  maybeCidPrefix(lines, group);
  lines.push(`same => n,Set(GRP_PICK=\${RAND(1,${n})})`);

  for (let i = 1; i < n; i++) {
    lines.push(`same => n,GotoIf($["\${GRP_PICK}" = "${i}"]?m${i})`);
  }
  lines.push(`same => n,Goto(m${n})`);

  for (let i = 0; i < n; i++) {
    const first = members[i];
    const rest = [...members.slice(0, i), ...members.slice(i + 1)];

    lines.push(
      `same => n(m${i + 1}),Dial(${memberInterface(first, vpbx, group.external_context, webrtcExtensions)},${first.ring_time},${dialOpts})`,
    );
    lines.push(ANSWER_RETURN);

    if (rest.length > 0) {
      const restTargets = rest
        .map((m) => memberInterface(m, vpbx, group.external_context, webrtcExtensions))
        .join('&');
      lines.push(buildDialLine(restTargets, group.ring_time, dialOpts));
    }
    lines.push(FINAL_RETURN);
  }
}

export function generateGroupDialplan(
  group: ICallGroup,
  members: ICallGroupMember[],
  vpbx: number,
  webrtcExtensions?: Set<string>,
  options?: GenerateGroupDialplanOptions,
): GeneratedDialplanCategory {
  const dialOpts = options?.dialOpts ?? 'tT';
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
      emitRandom(lines, group, sorted, vpbx, webrtcExtensions, dialOpts);
      break;
  }

  return { name: ctxName, lines };
}
