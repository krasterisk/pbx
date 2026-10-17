import { NotFoundException } from '@nestjs/common';
import { AutodialDiagnosisService } from './autodial-diagnosis.service';
import { countAutodialReadyAgents } from './autodial-ready-agents.util';

describe('AutodialDiagnosisService facts', () => {
  const campaign = { uid: 4, status: 'running', revision: 2, applied_revision: 2, dial_mode: 'agentless',
    pacing: { providers: [{ type: 'static', max_channels: 3 }] }, schedules: [], tasks_total: 10 };
  function setup() {
    const campaigns = { findOne: jest.fn().mockResolvedValue(campaign) };
    const query = jest.fn().mockResolvedValue([{ ready: '0', waiting: '2', next_attempt_at: new Date('2026-10-16T09:14:00Z') }]);
    const service = new AutodialDiagnosisService(campaigns as never,
      { listRuntimes: () => [], activeChannels: () => 0 } as never,
      { getAllAgents: () => [] } as never, { isConnected: () => true } as never, { query, getDialect: () => 'mysql' } as never);
    return { service, campaigns, query };
  }
  it('explains a future retry from persisted tasks instead of guessing from zero channels', async () => {
    const { service, query } = setup();
    const result = await service.diagnose(7, 4, new Date('2026-10-16T08:14:00Z'));
    expect(result.reasons).toEqual([{ code: 'waiting_retry', count: 2, next_at: '2026-10-16T09:14:00.000Z' }]);
    expect(query.mock.calls[0][1].replacements).toMatchObject({ userUid: 7, campaignUid: 4 });
  });
  it('refuses a foreign campaign before querying its tasks', async () => {
    const { service, campaigns, query } = setup();
    campaigns.findOne.mockRejectedValue(new NotFoundException());
    await expect(service.diagnose(8, 4)).rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
  });
  it('counts a READY operator only once across capacity queues', () => {
    expect(countAutodialReadyAgents({ providers: [{ type: 'queue_agents', queue_names: ['a', 'b'] }] }, [
      { userId: 1, interface: 'PJSIP/1', status: 'READY', queues: ['a', 'b'] },
      { userId: 1, interface: 'PJSIP/1-duplicate', status: 'READY', queues: ['a'] },
      { userId: 2, interface: 'PJSIP/2', status: 'PAUSED', queues: ['a'] },
    ])).toBe(1);
  });
});
