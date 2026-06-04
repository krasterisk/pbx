import { IvrsService } from './ivrs.service';
import { Ivr } from './ivr.model';

describe('IvrsService.generateIvrDialplan', () => {
  const service = new IvrsService(null as any);

  const baseIvr = {
    uid: 5,
    name: 'Test',
    timeout: '10',
    max_count: 0,
    menu_items: [],
  } as Ivr;

  it('emits Background for audio phrase', () => {
    const dp = service.generateIvrDialplan(
      { ...baseIvr, prompts: [{ kind: 'audio', filename: 'welcome.wav' }] } as Ivr,
      42,
    );
    expect(dp).toContain('Background(/usr/records/42/sounds/welcome.wav)');
    expect(dp).not.toContain('say_bg.php');
  });

  it('emits CURL play-phrase for tts phrase', () => {
    const dp = service.generateIvrDialplan(
      {
        ...baseIvr,
        prompts: [{ kind: 'tts', text: 'Привет', engine_uid: 3 }],
      } as Ivr,
      42,
    );
    expect(dp).toContain('internal/ivr/play-phrase');
    expect(dp).toContain('phrase_index=0');
    expect(dp).toContain('ivr_uid=5');
    expect(dp).not.toContain('say_bg.php');
  });
});
