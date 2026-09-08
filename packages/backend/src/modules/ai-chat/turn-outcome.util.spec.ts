import { classifyTurnClose, forcedTurnStatus } from './turn-outcome.util';

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
});
