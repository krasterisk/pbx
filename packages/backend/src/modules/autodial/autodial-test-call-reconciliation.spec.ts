import { AutodialTestCallService } from './autodial-test-call.service';

describe('test request reconciliation', () => {
  const row = { uid: 'a1234567-1234-1234-1234-123456789abc', status: 'ended', revision: 2,
    deadline_at: new Date(Date.now() + 60000), result_json: { delivery: 'playback_completed' } };
  function setup() {
    const db = { query: jest.fn() };
    const service = new AutodialTestCallService(db as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    return { service, db };
  }
  it('retrieves the admitted test even after the campaign revision changes', async () => {
    const { service, db } = setup(); db.query.mockResolvedValueOnce([{ uid: row.uid }]).mockResolvedValueOnce([row]);
    const result = await service.reconcile(7, 9, 12, 'same-request-123');
    expect(result.status).toBe('admitted'); expect(result.test?.revision).toBe(2);
    expect(result.test?.remaining_sec).toBe(0);
    expect(db.query.mock.calls[0][1].replacements).toEqual({ userUid: 7, actorUid: 9, campaignUid: 12, key: 'same-request-123' });
    expect(db.query.mock.calls[0][0]).toContain('actor_uid = :actorUid');
    expect(db.query.mock.calls[1][0]).toContain('campaign_uid = :campaignUid');
  });
  it('does not treat an unknown key as proof of failure or create a call', async () => {
    const { service, db } = setup(); db.query.mockResolvedValueOnce([]);
    expect(await service.reconcile(7, 9, 12, 'same-request-123')).toEqual({ status: 'unknown' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed keys before querying', async () => {
    const { service, db } = setup(); await expect(service.reconcile(7, 9, 12, 'x')).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
    await expect(service.reconcile(7, 9, 12, undefined as never)).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  });
});
