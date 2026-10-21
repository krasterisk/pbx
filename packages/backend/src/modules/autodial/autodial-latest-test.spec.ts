import { NotFoundException } from '@nestjs/common';
import { AutodialTestCallService } from './autodial-test-call.service';

describe('launch recent test evidence', () => {
  function setup() {
    const db = { query: jest.fn() }, campaigns = { findOne: jest.fn().mockResolvedValue({ revision: 3 }) };
    const service = new AutodialTestCallService(db as never, campaigns as never, {} as never, {} as never, {} as never, {} as never);
    return { service, db, campaigns };
  }
  it('checks campaign ownership before looking for test metadata', async () => {
    const { service, db, campaigns } = setup(); campaigns.findOne.mockRejectedValue(new NotFoundException());
    await expect(service.latest(7, 9, 12)).rejects.toThrow(NotFoundException);
    expect(campaigns.findOne).toHaveBeenCalledWith(7, 12);
    expect(db.query).not.toHaveBeenCalled();
  });
  it('keeps no own test distinct from a successful test', async () => {
    const { service, db } = setup(); db.query.mockResolvedValue([]);
    expect(await service.latest(7, 9, 12)).toBeNull();
    const [sql, options] = db.query.mock.calls[0];
    expect(options.replacements).toEqual({ userUid: 7, actorUid: 9, campaignUid: 12 });
    expect(sql).toContain('vpbx_user_uid = :userUid AND actor_uid = :actorUid AND campaign_uid = :campaignUid');
    expect(sql).toContain('ORDER BY created_at DESC, uid DESC LIMIT 1');
  });
  it('returns the admitted revision unchanged so a stale test cannot appear current', async () => {
    const { service, db } = setup(); const uid = 'a1234567-1234-1234-1234-123456789abc';
    db.query.mockResolvedValueOnce([{ uid }]).mockResolvedValueOnce([{ uid, revision: 2, status: 'ended', result_json: { delivery: 'playback_failed' } }]);
    const result = await service.latest(7, 9, 12);
    expect(result).toMatchObject({ uid, revision: 2, status: 'ended', result: { delivery: 'playback_failed' } });
    expect(db.query.mock.calls[1][1].replacements).toEqual({ uid, userUid: 7, actorUid: 9, campaignUid: 12 });
    expect(db.query.mock.calls.every(([sql]) => String(sql).trim().startsWith('SELECT'))).toBe(true);
  });
});
