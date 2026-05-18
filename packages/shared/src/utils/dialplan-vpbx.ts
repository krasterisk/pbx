const VPBX_SET_RE =
  /Set\s*\(\s*CDR\s*\(\s*vpbx_user_uid\s*\)\s*\)\s*=\s*[^\s,)]+/gi;
const VPBX_CDR_RE = /CDR\s*\(\s*vpbx_user_uid\s*\)/i;
const EXTEN_PRIO1_RE = /^\s*exten\s*=>\s*[^,]+,\s*1\s*,/i;
const EXTEN_ANY_RE = /^\s*exten\s*=>/i;

/**
 * Ensures each `exten => …,1,` block sets CDR(vpbx_user_uid) to the current tenant id.
 * Replaces wrong tenant ids; inserts `same => n,Set(CDR(vpbx_user_uid)=…)` when missing.
 */
export function ensureCdrVpbxUserUidInDialplan(
  dialplan: string,
  vpbxUserUid: number,
): string {
  const trimmed = dialplan.trim();
  if (!trimmed) return dialplan;

  const uid = String(vpbxUserUid);
  const insertLine = `same => n,Set(CDR(vpbx_user_uid)=${uid})`;

  const normalized = dialplan.replace(
    VPBX_SET_RE,
    `Set(CDR(vpbx_user_uid)=${uid})`,
  );

  const lines = normalized.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (!EXTEN_PRIO1_RE.test(lines[i])) continue;

    let hasVpbx = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (EXTEN_ANY_RE.test(line)) break;
      if (VPBX_CDR_RE.test(line)) {
        hasVpbx = true;
        break;
      }
    }
    if (!hasVpbx) {
      out.push(insertLine);
    }
  }

  return out.join('\n');
}
