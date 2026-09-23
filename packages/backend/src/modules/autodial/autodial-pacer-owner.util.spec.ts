import { Op } from 'sequelize';
import { PACER_OWNER_TTL_MS, pacerOwnerClaimWhere } from './autodial-pacer-owner.util';

describe('pacerOwnerClaimWhere', () => {
  const now = new Date('2026-09-21T12:00:00Z');

  it('lets a free or self-owned campaign be claimed', () => {
    const where = pacerOwnerClaimWhere(9, 'pacer-a', now);
    expect(where.uid).toBe(9);
    expect(where.status).toBe('running');
    const or = where[Op.or] as Array<Record<string, unknown>>;
    expect(or).toEqual(
      expect.arrayContaining([
        { pacer_owner: null },
        { pacer_owner: 'pacer-a' },
        { pacer_heartbeat_at: null },
      ]),
    );
  });

  it('treats a heartbeat older than the TTL as stealable', () => {
    const where = pacerOwnerClaimWhere(9, 'pacer-b', now);
    const or = where[Op.or] as Array<Record<string, unknown>>;
    const stale = or.find((clause) => clause.pacer_heartbeat_at && typeof clause.pacer_heartbeat_at === 'object');
    expect(stale).toEqual({
      pacer_heartbeat_at: { [Op.lt]: new Date(now.getTime() - PACER_OWNER_TTL_MS) },
    });
  });
});
