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
  useGetQueuesQuery: vi.fn(() => ({
    data: [{ name: 'qsales_42', exten: 'sales', display_name: 'Sales' }],
    isLoading: false,
  })),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: vi.fn(() => ({ data: [], isLoading: false })),
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
    case 'custom':
      return screen.getByRole('textbox', { name: LABEL });
    case 'secret':
      return screen.getByLabelText(LABEL);
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
      return screen.getByPlaceholderText(LABEL);
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
    const loadingAria = loading.getAttribute('aria-label');

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
    expect(empty.getAttribute('aria-label')).not.toBe(loadingAria);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', `/${source}`);
  });

  it('renders consecutive row fields side by side with weighted columns', () => {
    const { container } = render(
      <SchemaFields
        schema={[
          {
            key: 'dest',
            kind: 'text',
            labelKey: 'routes.chain.fields.dest',
            label: 'Назначение',
            row: 'destTimeout',
            rowWeight: 70,
          },
          {
            key: 'timeout',
            kind: 'duration',
            labelKey: 'routes.chain.fields.timeout',
            label: 'Таймаут, сек',
            row: 'destTimeout',
            rowWeight: 30,
          },
        ]}
        params={{ dest: '7900', timeout: 60 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Назначение')).toBeInTheDocument();
    expect(screen.getByLabelText('Таймаут, сек')).toBeInTheDocument();
    const row = container.querySelector('[style*="--schema-row-cols"]') as HTMLElement | null;
    expect(row).toBeTruthy();
    expect(row?.style.getPropertyValue('--schema-row-cols')).toContain('70fr');
    expect(row?.style.getPropertyValue('--schema-row-cols')).toContain('30fr');
  });

  it('handles array of visibleWhen rules correctly', () => {
    const schema: FieldSchema[] = [
      { key: 'trunkMode', kind: 'mode', labelKey: 'trunkMode', options: KIND_OPTIONS },
      { key: 'cid_mode', kind: 'mode', labelKey: 'cid_mode', options: KIND_OPTIONS },
      {
        key: 'callerid',
        kind: 'text',
        labelKey: 'callerid',
        label: 'CallerID Number',
        visibleWhen: [
          { key: 'trunkMode', equals: ['single', ''] },
          { key: 'cid_mode', equals: ['static', ''] },
        ],
      },
    ];

    const { rerender } = render(
      <SchemaFields
        schema={schema}
        params={{ trunkMode: 'single', cid_mode: 'static' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('CallerID Number')).toBeInTheDocument();

    rerender(
      <SchemaFields
        schema={schema}
        params={{ trunkMode: 'carousel', cid_mode: 'static' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('CallerID Number')).not.toBeInTheDocument();

    rerender(
      <SchemaFields
        schema={schema}
        params={{ trunkMode: 'single', cid_mode: 'phonebook' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('CallerID Number')).not.toBeInTheDocument();
  });
});

describe('chunkSchemaFields', () => {
  it('groups consecutive fields with the same row id', async () => {
    const { chunkSchemaFields } = await import('./SchemaFields');
    const chunks = chunkSchemaFields(
      [
        { key: 'trunk', kind: 'select', labelKey: 'trunk' },
        { key: 'dest', kind: 'text', labelKey: 'dest', row: 'destTimeout', rowWeight: 70 },
        { key: 'timeout', kind: 'duration', labelKey: 'timeout', row: 'destTimeout', rowWeight: 30 },
        { key: 'rewrite', kind: 'custom', labelKey: 'rewrite', render: () => null },
      ],
      {},
    );
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ kind: 'single', field: { key: 'trunk' } });
    expect(chunks[1]).toMatchObject({ kind: 'row', rowId: 'destTimeout' });
    if (chunks[1].kind === 'row') {
      expect(chunks[1].fields.map((f) => f.key)).toEqual(['dest', 'timeout']);
    }
    expect(chunks[2]).toMatchObject({ kind: 'single', field: { key: 'rewrite' } });
  });
});
