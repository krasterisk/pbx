import { NotFoundException } from '@nestjs/common';
import { AutodialBasesService } from './autodial-bases.service';

describe('customer call history boundaries', () => {
  function setup() {
    const service = Object.create(AutodialBasesService.prototype) as AutodialBasesService;
    const query = jest.fn(); Object.defineProperty(service, 'sequelize', { value: { query } });
    const contact = jest.spyOn(service, 'findContact').mockResolvedValue({ uid: 4 } as never);
    return { service, query, contact };
  }
  it('authorizes the exact tenant/base/customer before reading any history', async () => {
    const { service, query, contact } = setup(); contact.mockRejectedValue(new NotFoundException());
    await expect(service.contactHistory(7, 2, 4)).rejects.toThrow();
    expect(contact).toHaveBeenCalledWith(7, 2, 4); expect(query).not.toHaveBeenCalled();
  });
  it('bounds results and returns historical meaning without raw snapshots or credentials', async () => {
    const { service, query } = setup();
    const attempts = Array.from({ length: 51 }, (_, uid) => ({ uid, campaign_uid: 9, campaign_name: 'Fixture',
      started_at: new Date('2026-10-18T01:00:00Z'), ended_at: null, disposition: 'answered_short', billsec: '13',
      scenario_result: JSON.stringify({ business_outcome_label: 'Confirmed at call time', business_goal_relation: 'achieved', snapshot: { secret: 'must-not-return' } }) }));
    query.mockResolvedValueOnce(attempts).mockResolvedValueOnce([{ uid: 8, campaign_uid: 9, campaign_name: 'Fixture', status: 'waiting', next_attempt_at: new Date('2026-10-19T02:00:00Z') }]);
    const result = await service.contactHistory(7, 2, 4);
    expect(result.attempts).toHaveLength(50); expect(result.truncated).toBe(true);
    expect(result.attempts[0]).toMatchObject({ billsec: 13, outcome: 'Confirmed at call time', goal_relation: 'achieved' });
    expect(result.tasks[0].next_attempt_at).toBe('2026-10-19T02:00:00.000Z');
    expect(JSON.stringify(result)).not.toContain('must-not-return');
    for (const [sql, options] of query.mock.calls) {
      expect(sql).toContain('vpbx_user_uid = :tenant'); expect(sql).toContain('c.base_uid = :base'); expect(sql).toContain('c.uid = :contact');
      expect(options.replacements).toEqual({ tenant: 7, base: 2, contact: 4 });
    }
  });
});
