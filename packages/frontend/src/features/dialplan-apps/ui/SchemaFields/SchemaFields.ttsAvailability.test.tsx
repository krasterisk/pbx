import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaFields } from './SchemaFields';
import type { FieldSchema, SchemaCatalogRef } from '../../model/schema.types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
const schema: FieldSchema[] = [{ key: 'engine', kind: 'select', labelKey: 'Speech provider', optionsSource: 'tts-engines' }];
const base: SchemaCatalogRef = { items: [{ value: '3', label: 'Speech' }], isLoading: false, sectionHref: '/settings/tts-engines', sectionFallback: 'Speech providers' };
afterEach(() => vi.unstubAllEnvs());
function mount(catalog: SchemaCatalogRef, value: number | string = '', change = vi.fn()) {
  render(<SchemaFields schema={schema} params={{ engine: value }} refs={{ 'tts-engines': catalog }} onChange={change} />);
  return change;
}

describe('speech catalog availability', () => {
  it('does not offer administrative configuration from a read-only capability catalog', () => {
    mount({ ...base, items: [], sectionHref: null, emptyHint: 'Ask your administrator to enable speech.' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Ask your administrator to enable speech.');
    expect(screen.queryByText(/Сначала создайте/)).not.toBeInTheDocument();
  });
  it.each(['disabled', 'missing', 'empty'] as const)('refreshes a %s catalog without rewriting the draft selection', (state) => {
    const retry = vi.fn();
    const change = mount({ ...base, items: state === 'disabled' ? [{ value: '3', label: 'Off', disabled: true }] : [], onRetry: retry }, state === 'empty' ? '' : 3);
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
  });

  it('opens settings under the deployed application base', () => {
    vi.stubEnv('BASE_URL', '/v4/');
    mount({ ...base, items: [] });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/v4/settings/tts-engines');
  });

  it('shows a saved disabled provider without permitting new selection or rewriting its value', () => {
    const change = mount({ ...base, items: [{ value: '3', label: 'Off', disabled: true }] }, 3);
    expect(screen.getByRole('combobox')).toHaveValue('3');
    expect(screen.getByRole('option', { name: /Off/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.catalog.ttsDisabled');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    expect(change).not.toHaveBeenCalled();
  });

  it('retains a missing saved identifier and explains unavailability instead of displaying an empty selection', () => {
    const change = mount(base, 99);
    expect(screen.getByRole('combobox')).toHaveValue('99');
    expect(screen.getByRole('option', { name: 'common.statusUnavailable' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.catalog.ttsUnavailable');
    expect(change).not.toHaveBeenCalled();
  });

  it('disables retained choices after a failed request and retries without claiming the catalog is empty', () => {
    const retry = vi.fn(); mount({ ...base, isError: true, onRetry: retry }, 3);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.catalog.ttsLoadError');
    expect(screen.queryByText('Ничего не создано')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('distinguishes forbidden access from a failed network request', () => {
    mount({ ...base, items: [], isError: true, errorStatus: 403 });
    expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.catalog.ttsForbidden');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('explains an all-disabled catalog without calling it empty or selecting the first item', () => {
    const change = mount({ ...base, items: [{ value: '3', label: 'Off', disabled: true }] });
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByRole('alert')).toHaveTextContent('routes.chain.catalog.ttsNoneEnabled');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/settings/tts-engines');
    expect(change).not.toHaveBeenCalled();
  });
});
