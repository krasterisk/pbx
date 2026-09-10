import { buildIvrSetupDraft, extractDigitMap, extractGreeting, extractIvrName } from './ivr-setup-draft';

const HORNS = [
  'Создай IVR - Рога и копыта',
  'текст: "Здравствуйте, вы позвонили в Рога и копыта. Нажмите 1 для консультации, 2 для ремонта, 3 для гарантии, или оставайтесь на линии"',
  'Пункты:',
  '1 - Абонент 101',
  '2 - 102',
  '3 - 103 ничего не нажали - звонят все одновременно (группа вызова)',
].join('\n');

function toolsOf(message: string): string[] {
  return buildIvrSetupDraft(message)?.steps.map((step) => step.tool) ?? [];
}

function ivrArgs(message: string): {
  text?: string;
  menu_items?: Array<{
    digit?: string;
    destination?: { kind?: string; target?: string };
    actions?: Array<{ type?: string }>;
  }>;
} {
  return (buildIvrSetupDraft(message)?.steps.find((step) => step.tool === 'create_ivr')?.args ?? {}) as ReturnType<typeof ivrArgs>;
}

describe('buildIvrSetupDraft', () => {
  it('builds a three-step plan from the horns-hooves brief', () => {
    expect(extractIvrName(HORNS)).toMatch(/Рога и копыта/);
    expect(extractGreeting(HORNS)).toMatch(/Здравствуйте, вы позвонили в Рога и копыта/);
    expect(extractDigitMap(HORNS)).toEqual({ '1': '101', '2': '102', '3': '103' });

    const draft = buildIvrSetupDraft(HORNS);
    expect(draft).not.toBeNull();
    expect(draft?.title).toMatch(/Рога и копыта/);
    expect(draft?.steps.map((step) => step.tool)).toEqual([
      'create_endpoints_bulk',
      'create_call_group',
      'create_ivr',
    ]);
    const ivr = ivrArgs(HORNS);
    expect(ivr.text).toMatch(/Здравствуйте/);
    expect(ivr.menu_items?.map((item) => item.digit)).toEqual(['1', '2', '3', 't']);
    expect(ivr.menu_items?.find((item) => item.digit === 't')?.destination?.kind).toBe('group');
  });

  it('builds a hangup-timeout IVR without a call group', () => {
    const brief = [
      'Создай IVR - Простой офис',
      'текст: "Добро пожаловать. Нажмите 1 или 2"',
      '1 - Абонент 101',
      '2 - 102',
      'таймаут - сброс вызова',
    ].join('\n');
    expect(toolsOf(brief)).toEqual(['create_endpoints_bulk', 'create_ivr']);
    const t = ivrArgs(brief).menu_items?.find((item) => item.digit === 't');
    expect(t?.actions?.map((action) => action.type)).toEqual(['hangup']);
  });

  it('creates a queue step when a digit points at a queue', () => {
    const brief = [
      'Создай IVR - Поддержка',
      'текст: "Нажмите 1 для сотрудника, 2 для очереди"',
      '1 - Абонент 101',
      '2 - очередь Поддержка 8101',
      'таймаут - hangup',
    ].join('\n');
    expect(toolsOf(brief)).toEqual(['create_endpoints_bulk', 'create_queue', 'create_ivr']);
    const two = ivrArgs(brief).menu_items?.find((item) => item.digit === '2');
    expect(two?.destination).toEqual({ kind: 'queue', target: '8101' });
  });

  it('maps voicemail, playback and invalid-input hangup to dialplan apps', () => {
    const brief = [
      'Создай IVR - Сервис',
      'текст: "Сервисный отдел. 1 сотрудник, 2 почта, 3 файл"',
      '1 - Абонент 101',
      '2 - голосовая почта 101',
      '3 - проиграть beep',
      'таймаут - hangup',
      'неверный ввод - сброс вызова',
    ].join('\n');
    expect(toolsOf(brief)).toEqual(['create_endpoints_bulk', 'create_ivr']);
    const items = ivrArgs(brief).menu_items ?? [];
    expect(items.find((item) => item.digit === '2')?.actions?.[0]?.type).toBe('voicemail');
    expect(items.find((item) => item.digit === '3')?.actions?.[0]?.type).toBe('playback');
    expect(items.find((item) => item.digit === 'i')?.actions?.[0]?.type).toBe('hangup');
  });

  it('chains group then hangup on timeout together with a queue digit', () => {
    const brief = [
      'Создай IVR - Смешанный',
      'текст: "Смешанное меню компании"',
      '1 - Абонент 101',
      '2 - очередь Продажи 8205',
      'таймаут - группа вызова затем hangup',
      'неверный ввод - сброс',
    ].join('\n');
    expect(toolsOf(brief)).toEqual([
      'create_endpoints_bulk',
      'create_call_group',
      'create_queue',
      'create_ivr',
    ]);
    const t = ivrArgs(brief).menu_items?.find((item) => item.digit === 't');
    expect(t?.actions?.map((action) => action.type)).toEqual(['togroup', 'hangup']);
  });

  it('reads a dashed group number from the same complete brief', () => {
    const brief = `${HORNS}\nНомер группы - 9010`;
    const group = buildIvrSetupDraft(brief)?.steps.find((step) => step.tool === 'create_call_group');
    expect(group?.args.exten).toBe('9010');
    expect(ivrArgs(brief).menu_items?.find((item) => item.digit === 't')?.destination?.target).toBe('9010');
  });

  it('does not treat a short revision as a complete brief', () => {
    expect(buildIvrSetupDraft('Абонента 101 измени на 111')).toBeNull();
    expect(buildIvrSetupDraft('Изменени номер группы на 9010')).toBeNull();
  });

  it('does not invent a plan from a single-entity request', () => {
    expect(buildIvrSetupDraft('создай абонента 104')).toBeNull();
    expect(buildIvrSetupDraft('создай IVR Продажи')).toBeNull();
  });
});
