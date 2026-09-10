import { DIALPLAN_ACTION_META } from '@krasterisk/shared';
import { countDialplanAppUsage, listDialplanAppCatalog } from './dialplan-app-catalog';

describe('dialplan-app-catalog', () => {
  it('covers every DialplanAppsEditor type and drops route-only apps on the ivr host', () => {
    const all = listDialplanAppCatalog();
    expect(all.map((row) => row.type).sort()).toEqual(Object.keys(DIALPLAN_ACTION_META).sort());
    const ivr = listDialplanAppCatalog('ivr');
    expect(ivr.map((row) => row.type)).toEqual(expect.arrayContaining(['totrunk', 'togroup', 'hangup', 'voicemail']));
    expect(ivr.map((row) => row.type)).not.toEqual(expect.arrayContaining(['cmd', 'callback']));
    expect(ivr.find((row) => row.type === 'totrunk')?.need).toEqual(['trunk', 'dest']);
  });

  it('counts tenant usage from route chains and IVR digits', () => {
    const usage = countDialplanAppUsage(
      [{ actions: [{ type: 'toqueue' }, { type: 'hangup' }] }],
      [{ menu_items: [{ digit: 't', actions: [{ type: 'togroup' }, { type: 'totrunk' }] }] }],
    );
    expect(usage).toEqual({
      toqueue: { routes: 1, ivrs: 0 },
      hangup: { routes: 1, ivrs: 0 },
      togroup: { routes: 0, ivrs: 1 },
      totrunk: { routes: 0, ivrs: 1 },
    });
  });
});
