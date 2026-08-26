import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';
import { resolveRouteRawDialplanPayload } from './resolveRouteRawDialplanPayload';

const RAW = [
  'exten => 2236246,1,NoOp(Route: 2236246)',
  'same => n,Dial(PJSIP/e201_0&PJSIP/ew201_0,60,tThH)',
  'same => n,Stasis(krasterisk_robot_dev,4)',
].join('\n');

describe('resolveRouteRawDialplanPayload', () => {
  const loaded = ensureCdrVpbxUserUidInDialplan(RAW, 0);

  it('keeps loaded raw when the visibility flag is off (D-16)', () => {
    expect(
      resolveRouteRawDialplanPayload({
        showRawDialplan: false,
        editorMode: 'table',
        rawDialplan: loaded,
        loadedRawDialplan: RAW,
        vpbxUserUid: 0,
        actionsChanged: true,
      }),
    ).toBe(loaded);
  });

  it('clears raw when table actions were reordered', () => {
    expect(
      resolveRouteRawDialplanPayload({
        showRawDialplan: true,
        editorMode: 'table',
        rawDialplan: loaded,
        loadedRawDialplan: RAW,
        vpbxUserUid: 0,
        actionsChanged: true,
      }),
    ).toBe('');
  });

  it('clears stale raw if the user reordered then opened Dialplan without editing it', () => {
    expect(
      resolveRouteRawDialplanPayload({
        showRawDialplan: true,
        editorMode: 'raw',
        rawDialplan: loaded,
        loadedRawDialplan: RAW,
        vpbxUserUid: 0,
        actionsChanged: true,
      }),
    ).toBe('');
  });

  it('keeps an edited raw snapshot even if actions also changed', () => {
    const edited = `${loaded}\nsame => n,Hangup()`;
    expect(
      resolveRouteRawDialplanPayload({
        showRawDialplan: true,
        editorMode: 'raw',
        rawDialplan: edited,
        loadedRawDialplan: RAW,
        vpbxUserUid: 0,
        actionsChanged: true,
      }),
    ).toBe(ensureCdrVpbxUserUidInDialplan(edited, 0));
  });

  it('clears raw on a table save even when actions did not change', () => {
    expect(
      resolveRouteRawDialplanPayload({
        showRawDialplan: true,
        editorMode: 'table',
        rawDialplan: loaded,
        loadedRawDialplan: RAW,
        vpbxUserUid: 0,
        actionsChanged: false,
      }),
    ).toBe('');
  });
});
