import { callDimensions } from './call-dimensions';
import { classifyCall } from './call-record';
describe('historical call directories', () => {
  it('keeps one dimension per entity, normalizes department/company phone and separates robot kinds', () => {
    const call = classifyCall(
      42,
      'test',
      [
        {
          uniqueid: 'one',
          calldate: '2026-10-18 00:00:00',
          channel: 'PJSIP/e101_42-a',
          dstchannel: 'PJSIP/e102_42-b',
          duration: 2,
          billsec: 1,
          lastapp: 'Dial',
          disposition: 'ANSWERED',
        },
      ],
      { complete: true },
    );
    call.caller.name = 'Анна';
    call.caller.department = 'Продажи';
    call.companyNumber = '8 (391) 222-33-44';
    call.participants.push(
      call.caller,
      {
        kind: 'voiceRobot',
        id: '7',
        number: null,
        name: 'Сценарий',
        department: null,
      },
      {
        kind: 'aiRobot',
        id: '7',
        number: null,
        name: 'Помощник',
        department: null,
      },
    );
    const rows = callDimensions(call);
    expect(
      rows.filter((r) => r.kind === 'employee' && r.value === '101'),
    ).toHaveLength(1);
    expect(rows).toEqual(
      expect.arrayContaining([
        { kind: 'department', value: 'продажи', label: 'Продажи' },
        {
          kind: 'companyNumber',
          value: '73912223344',
          label: '8 (391) 222-33-44',
        },
        { kind: 'robot', value: 'voiceRobot:7', label: 'Сценарий' },
        { kind: 'robot', value: 'aiRobot:7', label: 'Помощник' },
      ]),
    );
  });
});
