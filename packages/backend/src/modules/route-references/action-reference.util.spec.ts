import { collectActionReferences } from './action-reference.util';

const toIvr = {
  id: 'to-ivr-7',
  type: 'toivr',
  params: { ivr_uid: 7 },
  condition: {},
};

const toQueue = {
  id: 'to-q100',
  type: 'toqueue',
  params: { target: { source: 'fixed', value: 'q100' } },
  condition: {},
};

const toGroup = {
  id: 'to-g12',
  type: 'togroup',
  params: { target: { source: 'fixed', value: 12 } },
  condition: {},
};

const notify = {
  id: 'n1',
  type: 'notify',
  params: { integration_uid: 22 },
  condition: {},
};

const voiceRobot = {
  id: 'vr1',
  type: 'voicerobot',
  params: { robot_uid: 9 },
  condition: {},
};

const toList = {
  id: 'list-1',
  type: 'tolist',
  params: { numbers: '101,102' },
  condition: {},
};

const confbridge = {
  id: 'conf-1',
  type: 'confbridge',
  params: { room: 'sales' },
  condition: {},
};

const directoryLookup = {
  id: 'dir-1',
  type: 'directory_lookup',
  params: {
    directoryUid: 7,
    keySource: { source: 'original_caller' },
    outputs: [{ fieldUid: 17, targetVariable: 'CID_NUM' }],
    onMissing: 'keep',
  },
  condition: {},
};

describe('collectActionReferences (D-48)', () => {
  it('returns a route/action hit for toivr.ivr_uid', () => {
    const hits = collectActionReferences('ivr', 7, [
      { uid: 5, actions: [toIvr, toQueue] },
    ]);
    expect(hits).toEqual([
      expect.objectContaining({
        routeUid: 5,
        actionOrBindingId: 'to-ivr-7',
      }),
    ]);
    expect(hits[0].location).toMatch(/route\s*5/i);
    expect(hits[0].location.toLowerCase()).toMatch(/action/);
  });

  it('returns a hit for toqueue target q100', () => {
    const queueUid = 'q100';
    const hits = collectActionReferences('queue', queueUid, [
      { uid: 8, actions: [toQueue] },
    ]);
    expect(hits).toEqual([
      expect.objectContaining({
        routeUid: 8,
        actionOrBindingId: 'to-q100',
      }),
    ]);
  });

  it('returns a hit for togroup target 12', () => {
    const hits = collectActionReferences('group', 12, [
      { uid: 2, actions: [toGroup] },
    ]);
    expect(hits).toEqual([
      expect.objectContaining({
        routeUid: 2,
        actionOrBindingId: 'to-g12',
      }),
    ]);
  });

  it('scans notify.integration_uid and voicerobot.robot_uid', () => {
    const routes = [{ uid: 3, actions: [notify, voiceRobot] }];
    const integrations = collectActionReferences('integration', 22, routes);
    const robots = collectActionReferences('voicerobot', 9, routes);
    expect(integrations).toEqual([
      expect.objectContaining({ routeUid: 3, actionOrBindingId: 'n1' }),
    ]);
    expect(robots).toEqual([
      expect.objectContaining({ routeUid: 3, actionOrBindingId: 'vr1' }),
    ]);
  });

  it('excludes tolist and confbridge (no entity id per research A6)', () => {
    const routes = [{ uid: 4, actions: [toList, confbridge] }];
    expect(collectActionReferences('queue', '101', routes)).toEqual([]);
    expect(collectActionReferences('queue', 'sales', routes)).toEqual([]);
    expect(collectActionReferences('ivr', 4, routes)).toEqual([]);
  });

  it('still scans directory field keys migrated from directory-reference.util', () => {
    const hits = collectActionReferences(
      'directory',
      7,
      [{ uid: 5, actions: [directoryLookup] }],
      [],
      17,
    );
    expect(hits).toEqual([
      expect.objectContaining({
        routeUid: 5,
        actionOrBindingId: 'dir-1',
      }),
    ]);
  });
});
