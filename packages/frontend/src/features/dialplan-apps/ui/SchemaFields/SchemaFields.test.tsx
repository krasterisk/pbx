import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { FieldKind, FieldSchema, OptionsSource } from '../../model/schema.types';
import { SchemaFields } from './SchemaFields';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

const LABEL = 'routes.chain.fields.demo';

const KIND_OPTIONS = [
  { value: 'a', labelKey: 'opt.a', label: 'Alpha' },
  { value: 'b', labelKey: 'opt.b', label: 'Beta' },
];

function fieldForKind(kind: FieldKind): FieldSchema {
  const base: FieldSchema = {
    key: 'field',
    kind,
    labelKey: 'routes.chain.fields.demo',
  };
  if (kind === 'select' || kind === 'multiselect' || kind === 'mode' || kind === 'choice-cards') {
    return { ...base, options: KIND_OPTIONS };
  }
  if (kind === 'custom') {
    return {
      ...base,
      render: ({ onChange, field }) => (
        <input
          aria-label={LABEL}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
        />
      ),
    };
  }
  if (kind === 'value-source') {
    return { ...base, optionsSource: 'queues' };
  }
  return base;
}

function findControl(kind: FieldKind): HTMLElement {
  switch (kind) {
    case 'text':
    case 'secret':
    case 'custom':
      return screen.getByRole('textbox', { name: LABEL });
    case 'number':
    case 'duration':
      return screen.getByRole('spinbutton', { name: LABEL });
    case 'select':
    case 'value-source':
      return screen.getByRole('combobox', { name: LABEL });
    case 'multiselect':
      return screen.getByLabelText(LABEL);
    case 'toggle':
      return screen.getByRole('switch', { name: LABEL });
    case 'checkbox':
      return screen.getByRole('checkbox', { name: LABEL });
    case 'tags':
      return screen.getByRole('textbox', { name: LABEL });
    case 'choice-cards':
      return screen.getByRole('radiogroup', { name: LABEL });
    case 'mode':
      return screen.getByRole('tablist', { name: LABEL });
    default:
      throw new Error(`no finder for ${kind}`);
  }
}

const ALL_KINDS: FieldKind[] = [
  'text',
  'number',
  'duration',
  'select',
  'multiselect',
  'toggle',
  'checkbox',
  'tags',
  'choice-cards',
  'mode',
  'secret',
  'value-source',
  'custom',
];

describe('SchemaFields', () => {
  it.each(ALL_KINDS)('renders an accessible control for kind %s', (kind) => {
    render(
      <SchemaFields
        schema={[fieldForKind(kind)]}
        params={{}}
        onChange={vi.fn()}
        refs={{
          queues: {
            items: [{ value: 'sales', label: 'Sales' }],
            isLoading: false,
            sectionHref: '/queues',
            sectionFallback: 'Очереди',
          },
        }}
      />,
    );
    expect(findControl(kind)).toBeInTheDocument();
  });

  it('throws on an unknown kind instead of rendering emptiness', () => {
    expect(() =>
      render(
        <SchemaFields
          schema={[{ key: 'x', kind: 'not-a-kind' as FieldKind, labelKey: 'x' }]}
          params={{}}
          onChange={vi.fn()}
        />,
      ),
    ).toThrow();
  });

  it('marks a required empty field aria-invalid', () => {
    render(
      <SchemaFields
        schema={[{ key: 'name', kind: 'text', required: true, labelKey: 'routes.chain.fields.demo' }]}
        params={{ name: '' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: LABEL })).toHaveAttribute('aria-invalid', 'true');
  });

  it('calls onChange with a single-key patch', () => {
    const onChange = vi.fn();
    render(
      <SchemaFields
        schema={[
          { key: 'name', kind: 'text', labelKey: 'routes.chain.fields.demo' },
          { key: 'timeout', kind: 'number', labelKey: 'routes.chain.fields.timeout' },
        ]}
        params={{ name: '', timeout: 10 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: LABEL }), { target: { value: 'ok' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(patch)).toHaveLength(1);
    expect(patch).toEqual({ name: 'ok' });
  });

  it.each<[OptionsSource, string]>([
    ['queues', 'Очереди'],
    ['trunks', 'Транки'],
    ['ivrs', 'IVR'],
    ['prompts', 'Промпты'],
  ])('distinguishes loading vs empty for catalog %s (backstop)', (source, section) => {
    const schema: FieldSchema[] = [
      {
        key: 'ref',
        kind: 'select',
        labelKey: 'routes.chain.fields.demo',
        optionsSource: source,
      },
    ];
    const { rerender } = render(
      <SchemaFields
        schema={schema}
        params={{}}
        onChange={vi.fn()}
        refs={{
          [source]: {
            items: [],
            isLoading: true,
            sectionHref: `/${source}`,
            sectionFallback: section,
          },
        }}
      />,
    );

    const loading = screen.getByRole('combobox', { name: 'Загружаем список' });
    expect(loading).toBeDisabled();
    const loadingText = loading.textContent;

    rerender(
      <SchemaFields
        schema={schema}
        params={{}}
        onChange={vi.fn()}
        refs={{
          [source]: {
            items: [],
            isLoading: false,
            sectionHref: `/${source}`,
            sectionFallback: section,
          },
        }}
      />,
    );

    const empty = screen.getByRole('combobox', { name: 'Ничего не создано' });
    expect(empty).toBeDisabled();
    expect(empty.textContent).not.toBe(loadingText);
    expect(empty.textContent).not.toBe(loading.getAttribute('aria-label'));
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', `/${source}`);
  });
});
