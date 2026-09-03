import { templateSlotMarker } from '@krasterisk/shared';
import { applyTemplateActions } from './apply-template.util';

describe('applyTemplateActions', () => {
  it('assigns a fresh id per action and fills slot markers', () => {
    const actions = applyTemplateActions(
      [
        {
          id: 'old-1',
          type: 'toivr',
          params: { ivr_uid: templateSlotMarker('ivr') },
          condition: {},
        },
        {
          id: 'old-2',
          type: 'playback',
          params: { files: templateSlotMarker('greeting') },
          condition: {},
        },
      ],
      [
        { id: 'ivr', kind: 'ivr', label: 'IVR' },
        { id: 'greeting', kind: 'recording', label: 'Greeting' },
      ],
      {
        ivr: { uid: 7 },
        greeting: { uid: 3, name: 'welcome' },
      },
    );

    expect(actions[0].id).not.toBe('old-1');
    expect(actions[1].id).not.toBe('old-2');
    expect(actions[0].id).not.toBe(actions[1].id);
    expect(actions[0].params.ivr_uid).toBe('7');
    expect(actions[1].params.files).toBe('welcome');
  });
});
