/**
 * CDR tenant display helpers — parse PJSIP channel IDs to user-friendly numbers.
 */

export type CdrDirection = 'in' | 'out' | 'internal' | 'external';

export interface CdrRowLike {
  usrc?: string | null;
  src?: string | null;
  dst?: string | null;
  dcontext?: string | null;
  dialednum?: string | null;
  channel?: string | null;
  dstchannel?: string | null;
}

/** Internal extension: up to 4 digits (v3 int filter) */
export function isInternal(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 && digits.length <= 4;
}

/**
 * Extract tenant extension from channel id or raw value.
 * PJSIP/e100_42-00000123 -> 100, e100_42 -> 100, 100 -> 100
 */
export function extractExtension(
  channelOrSrc: string | null | undefined,
  tenantId: number,
): string | null {
  if (!channelOrSrc) return null;
  const raw = channelOrSrc.trim();
  const suffix = `_${tenantId}`;

  // PJSIP/e100_42-xxxx or SIP/e100_42
  const slashMatch = raw.match(/\/([^/]+)/);
  const idPart = slashMatch ? slashMatch[1].split('-')[0] : raw.split('-')[0];

  if (idPart.startsWith('e') && idPart.endsWith(suffix)) {
    return idPart.slice(1, -suffix.length);
  }
  if (/^\d{1,6}$/.test(idPart)) {
    return idPart;
  }
  if (isInternal(idPart)) {
    return idPart;
  }
  return null;
}

/**
 * Extract trunk slug from channel: PJSIP/t_megafon_42-... -> megafon
 */
export function extractTrunkSlug(
  channelOrSrc: string | null | undefined,
  tenantId: number,
): string | null {
  if (!channelOrSrc) return null;
  const raw = channelOrSrc.trim();
  const suffix = `_${tenantId}`;
  const slashMatch = raw.match(/\/([^/]+)/);
  const idPart = slashMatch ? slashMatch[1].split('-')[0] : raw.split('-')[0];

  if (idPart.startsWith('t_') && idPart.endsWith(suffix)) {
    const inner = idPart.slice(2, -suffix.length);
    return inner || null;
  }
  return null;
}

/** Classify call direction for filters (v3-compatible) */
export function classifyDirection(row: CdrRowLike, tenantId: number): CdrDirection {
  const outCtx = `sip-out${tenantId}`;
  if (row.dcontext?.startsWith(outCtx) || row.dcontext === outCtx) {
    return 'out';
  }
  if (row.dialednum && String(row.dialednum).trim() !== '') {
    return 'in';
  }
  const src = row.usrc || row.src || '';
  const dst = row.dst || '';
  if (isInternal(src) && isInternal(dst)) {
    return 'internal';
  }
  return 'external';
}

/** Strip channel to short form (before first dash) */
export function shortenChannel(channel: string | null | undefined): string {
  if (!channel) return '';
  const idx = channel.indexOf('-');
  return idx >= 0 ? channel.slice(0, idx) : channel;
}

/** Map disposition to answered flag (v3 logic) */
export function isAnswered(disposition: string | null | undefined, dstchannel: string | null | undefined): boolean {
  return disposition === 'ANSWERED' && Boolean(dstchannel && dstchannel.trim() !== '');
}

/** SQL + bindings for tenant isolation on raw `cdr` legs (incl. NULL vpbx_user_uid). */
export function tenantLegFilter(vpbxUserUid: number): {
  sql: string;
  replacements: Record<string, unknown>;
} {
  return {
    sql: `(
      c.vpbx_user_uid = :vpbxUserUid
      OR (
        c.vpbx_user_uid IS NULL
        AND (
          c.channel LIKE :tenantChanPat
          OR c.dstchannel LIKE :tenantChanPat
          OR c.dcontext = :ctxOut
          OR c.dcontext = :ctxIn
          OR c.dcontext LIKE :ctxOutLike
          OR c.dcontext LIKE :ctxInLike
        )
      )
    )`,
    replacements: {
      vpbxUserUid,
      // PJSIP/e201_0-… / t_megafon_0-… (_ is literal in LIKE)
      tenantChanPat: `%\\_${vpbxUserUid}-%`,
      ctxOut: `sip-out${vpbxUserUid}`,
      ctxIn: `sip-in${vpbxUserUid}`,
      ctxOutLike: `sip-out${vpbxUserUid}%`,
      ctxInLike: `sip-in${vpbxUserUid}%`,
    },
  };
}
