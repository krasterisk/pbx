import {
  artifactsForCall,
  enrichCallNames,
  loadCallEnrichment,
} from './call-enrichment';
import { classifyCall } from './call-record';
import type { DashboardLeg } from './call-classifier';

const leg: DashboardLeg = {
  uniqueid: 'child',
  linkedid: 'root',
  calldate: '2026-10-18 10:00:00',
  channel: 'PJSIP/t_main_42-a',
  dstchannel: 'PJSIP/e201_42-b',
  lastapp: 'Dial',
  disposition: 'ANSWERED',
  duration: 30,
  billsec: 20,
};
describe('optional call module artifacts', () => {
  it('loads ring-group labels only from the current tenant directory',async()=>{
    const reader={select:jest.fn().mockResolvedValue([{exten:'700',name:'Отдел продаж'}])};
    const data=await loadCallEnrichment(reader,new Set(['call_groups']),42,[leg]);
    expect(reader.select).toHaveBeenCalledWith(expect.stringContaining('vpbx_user_uid=:tenant'),{tenant:42});
    const call=classifyCall(42,'node',[{...leg,dcontext:'group_700_42'}],{complete:true});enrichCallNames(call,data);
    expect(call.groups).toEqual([{id:'700',name:'Отдел продаж'}]);
  });
  it('works without robots, voicemail or speech analytics installed', async () => {
    const reader = { select: jest.fn().mockResolvedValue([]) };
    const data = await loadCallEnrichment(reader, new Set(), 42, [leg]);
    expect(reader.select).not.toHaveBeenCalled();
    expect(artifactsForCall([leg], data)).toEqual({});
  });

  it('retains a usable analysis when a later attempt failed and joins artifacts from every leg', async () => {
    const reader = {
      select: jest.fn(async (sql: string) => {
        if (sql.includes('FROM sa_recording_relations'))
          return [
            {
              source_id: 'child',
              linkedid: 'root',
              recording_id: 'r',
              id: 'new',
              state: 'failed',
              project_id: 'p',
              result_id: null,
            },
            {
              source_id: 'child',
              linkedid: 'root',
              recording_id: 'r',
              id: 'old',
              state: 'completed',
              project_id: 'p',
              result_id: 'result',
            },
          ];
        if (sql.includes('FROM voicemail_messages'))
          return [{ uniqueid: 'root' }];
        if (sql.includes('FROM voice_robot_cdr'))
          return [
            { call_uniqueid: 'child', robot_id: 7, robot_name: 'Помощник' },
          ];
        return [];
      }),
    };
    const tables = new Set([
      'sa_recording_relations',
      'sa_analysis_runs',
      'sa_project_versions',
      'voicemail_messages',
      'voice_robot_cdr',
    ]);
    const data = await loadCallEnrichment(reader, tables, 42, [leg], 'node');
    expect(artifactsForCall([leg], data)).toMatchObject({
      voicemail: true,
      voicemailCallId: 'root',
      voiceRobot: true,
      analytics: { state: 'analyzed', runId: 'old', recordingId: 'r' },
      robots: [{ name: 'Помощник' }],
    });
    for (const [sql] of reader.select.mock.calls)
      expect(sql).toContain('=:tenant');
    expect(reader.select).toHaveBeenCalledWith(
      expect.stringContaining('r.node_id=:nodeId'),
      expect.objectContaining({ tenant: 42, nodeId: 'node' }),
    );
  });

  it('does not link analysis without a known PBX node', async () => {
    const reader = { select: jest.fn().mockResolvedValue([]) };
    await loadCallEnrichment(
      reader,
      new Set([
        'sa_recording_relations',
        'sa_analysis_runs',
        'sa_project_versions',
      ]),
      42,
      [leg],
    );
    expect(reader.select).not.toHaveBeenCalled();
  });

  it('uses business names for both parties and journey targets', async () => {
    const call = classifyCall(42, 'node', [leg], { complete: true });
    enrichCallNames(call, {
      events: [],
      artifacts: new Map(),
      names: new Map([
        ['employee:201', { name: 'Анна', department: 'Продажи' }],
      ]),
    });
    expect(call.recipient).toMatchObject({
      name: 'Анна',
      department: 'Продажи',
    });
    expect(
      call.journey.find((step) => step.kind === 'attempt')?.target?.name,
    ).toBe('Анна');
  });
});
