import { classifyTurnClose, forcedTurnStatus, looksLikeMultiEntitySetup } from './turn-outcome.util';

describe('looksLikeMultiEntitySetup', () => {
  it('treats the horns-hooves IVR brief as one batched plan', () => {
    expect(looksLikeMultiEntitySetup(
      'Создай IVR - Рога и копыта\n'
      + 'текст: "Здравствуйте, вы позвонили в Рога и копыта. Нажмите 1 для консультации, 2 для ремонта, 3 для гарантии, или оставайтесь на линии"\n'
      + 'Пункты:\n1 - Абонент 101\n2 - 102\n3 - 103 ничего не нажали - звонят все одновременно (группа вызова)',
    )).toBe(true);
  });

  it('leaves a single-entity create on the ordinary card path', () => {
    expect(looksLikeMultiEntitySetup('создай абонента 104')).toBe(false);
    expect(looksLikeMultiEntitySetup('создай IVR Продажи')).toBe(false);
  });
});

describe('classifyTurnClose', () => {
  it('treats the bulk-create narration as incomplete so the turn cannot go silent', () => {
    const text =
      'Абоненты 101, 102 и 103 пока что отсутствуют в системе! Давайте создадим их сначала через массовое создание (bulk), затем группу вызова для таймаута, и только потом IVR-меню.';
    expect(classifyTurnClose(text)).toBe('incomplete');
  });

  it('treats an empty reply as incomplete', () => {
    expect(classifyTurnClose('')).toBe('incomplete');
    expect(classifyTurnClose('   ')).toBe('incomplete');
  });

  it('treats a clarifying question as question', () => {
    expect(classifyTurnClose('Какой номер дать группе на таймаут — свободный или 600?')).toBe('question');
  });

  it('does not treat a truncated create_ivr essay as a finished answer', () => {
    const truncated =
      'Для timeout нужно указать группу. Судя по документации, menu_items = [{digit, actions}], где digit может быть "1", "2", "3" и т';
    expect(classifyTurnClose(truncated)).toBe('incomplete');
    expect(classifyTurnClose(truncated, { truncated: true })).toBe('incomplete');
  });

  it('does not treat a rhetorical question inside a create_ivr plan as wait-for-user', () => {
    const essay =
      'Пользователь просит создать IVR. Для timeout обычно digit="t". Но как реализовать? Обычно создают отдельный пункт. Давайте создам IVR: {"name": "Продажи", "menu_items": [';
    expect(classifyTurnClose(essay)).toBe('incomplete');
  });

  it('treats a card confirm ask as wait_confirm', () => {
    expect(classifyTurnClose('Подтвердите карточку абонентов. Осталось: группа и меню.')).toBe('wait_confirm');
  });

  it('treats a factual answer as complete', () => {
    expect(classifyTurnClose('У вас три очереди.')).toBe('complete');
  });

  it('treats a schema-dump after a failed plan as incomplete', () => {
    const dump =
      'Ой, в create_call_group параметр exten должен быть строкой (2–8 цифр), а не число. '
      + 'Исправлю на "6001". Также проверю: в меню items для цифры t нужно указать destination.kind:"group". '
      + 'В описании update_ivr: "target" может быть string or number. Для группы лучше указать exten="6001".';
    expect(classifyTurnClose(dump)).toBe('incomplete');
  });

  it('keeps a short user-facing summary complete', () => {
    expect(classifyTurnClose('Исправлю план и попробую снова.')).toBe('complete');
  });

  it('treats the live hang replica after a group card as incomplete', () => {
    const text = 'Отлично! Группа создана. Теперь создам сам';
    expect(classifyTurnClose(text)).toBe('incomplete');
    expect(classifyTurnClose(text, { hadProposal: true })).toBe('incomplete');
  });

  it('after a pending card requires wait_confirm or a question, not a created-claim', () => {
    expect(classifyTurnClose('Группа создана.', { hadProposal: true })).toBe('incomplete');
    expect(classifyTurnClose('Подтвердите карточку группы. Осталось меню.', { hadProposal: true }))
      .toBe('wait_confirm');
  });
});

describe('forcedTurnStatus', () => {
  it('always names a next user action', () => {
    const text = forcedTurnStatus({ locale: 'ru', hadProposal: true, lastAssistant: 'Создадим через bulk' });
    expect(text).toMatch(/Подтвердить|подтвержд/i);
    expect(text.length).toBeGreaterThan(20);
  });

  it('does not quote schema reasoning in the forced status', () => {
    const text = forcedTurnStatus({
      locale: 'ru',
      lastAssistant:
        'Ой, в create_call_group параметр exten должен быть строкой. В описании update_ivr target — string or number.',
    });
    expect(text).not.toMatch(/create_call_group|string or number|должен быть строк/i);
    expect(text).toMatch(/Повторите запрос|уточните/i);
  });
});
