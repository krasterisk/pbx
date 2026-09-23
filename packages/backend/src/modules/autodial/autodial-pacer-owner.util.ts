import { Op } from 'sequelize';

/** Heartbeat older than this means another worker may steal campaign ownership. */
export const PACER_OWNER_TTL_MS = 5_000;

export function pacerOwnerClaimWhere(
  campaignUid: number,
  owner: string,
  now: Date,
  ttlMs = PACER_OWNER_TTL_MS,
): Record<string, unknown> {
  const cutoff = new Date(now.getTime() - ttlMs);
  return {
    uid: campaignUid,
    status: 'running',
    [Op.or]: [
      { pacer_owner: null },
      { pacer_owner: owner },
      { pacer_heartbeat_at: { [Op.lt]: cutoff } },
      { pacer_heartbeat_at: null },
    ],
  };
}
