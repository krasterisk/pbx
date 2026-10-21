import { describe, expect, it } from 'vitest';
import { cardTemplateErrorText, toCardFieldPayload } from './cardTemplatePayload';
import type { ICardField } from '../model/types/callCard';

describe('toCardFieldPayload', () => {
  it('drops server columns that the update endpoint rejects', () => {
    const stored = {
      uid: 5,
      template_id: 5,
      user_uid: 0,
      field_key: 'theme_call',
      field_type: 'multi_select',
      label: 'Тема звонка',
      options: ['Информация'],
      sort_order: 9,
    } as ICardField & { uid: number; template_id: number; user_uid: number };

    expect(toCardFieldPayload(stored, 2)).toEqual({
      field_key: 'theme_call',
      field_type: 'multi_select',
      label: 'Тема звонка',
      placeholder: '',
      is_required: false,
      default_value: '',
      options: ['Информация'],
      depends_on: null,
      depends_values: null,
      sort_order: 2,
      width: 'full',
      auto_populate: null,
    });
  });
});

describe('cardTemplateErrorText', () => {
  it('hides validator property dumps behind a sentence a person can read', () => {
    expect(cardTemplateErrorText([
      'fields.2.property uid should not exist',
      'fields.2.property template_id should not exist',
    ], 'Не удалось сохранить шаблон')).toBe('Не удалось сохранить шаблон');
  });

  it('keeps a message that is already written for a person', () => {
    expect(cardTemplateErrorText('Укажите название', 'Не удалось')).toBe('Укажите название');
  });
});
