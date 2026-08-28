import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrunkCarouselTrunksField } from './TrunkCarouselTrunksField';
import type { IDirectory, ITrunkCarouselItem } from '@krasterisk/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: () => ({
    data: [
      { id: 't_alpha_100', name: 'Alpha' },
      { id: 't_beta_100', name: 'Beta' },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../model/useSchemaRefs', () => ({
  useSchemaRefs: () => ({
    dialplanDirectories: {
      items: [
        { value: '7', label: 'Customers' },
        { value: '8', label: 'VIP' },
      ],
      isLoading: false,
    },
  }),
}));

const DIRECTORY_7: IDirectory = {
  uid: 7,
  user_uid: 1,
  name: 'Customers',
  lookup_field_uid: 17,
  key_normalization: 'digits',
  revision: 1,
  fields: [
    { uid: 17, directory_uid: 7, key: 'phone', label: 'Phone', type: 'phone', required: true, position: 0 },
    { uid: 18, directory_uid: 7, key: 'mobile', label: 'Mobile', type: 'phone', required: false, position: 1 },
  ],
};

vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoryQuery: () => ({
    data: DIRECTORY_7,
    isLoading: false,
  }),
}));

describe('TrunkCarouselTrunksField', () => {
  it('adds a carousel row with trunkId and static callerId', () => {
    const onChange = vi.fn();
    render(<TrunkCarouselTrunksField params={{ trunks: [] }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Добавить транк/i }));
    expect(onChange).toHaveBeenCalledWith({
      trunks: [{
        trunkId: '',
        callerId: { mode: 'static', value: '' },
        timeout: 60,
      }],
    });
  });

  it('uses ITrunkListItem.id as the trunk option value', () => {
    render(
      <TrunkCarouselTrunksField
        params={{
          trunks: [{ trunkId: 't_beta_100', callerId: { mode: 'static', value: '' }, timeout: 45 }],
        }}
        onChange={vi.fn()}
      />,
    );

    const trunkSelect = screen.getByLabelText('Транк') as HTMLSelectElement;
    expect(trunkSelect).toHaveValue('t_beta_100');
    const values = Array.from(trunkSelect.options).map((option) => option.value);
    expect(values).toContain('t_alpha_100');
    expect(values).toContain('t_beta_100');
    expect(values).not.toContain('Alpha');
    expect(values).not.toContain('PJSIP/trunk1');
  });

  function CarouselHarness({
    initial,
    onChange,
  }: {
    initial: ITrunkCarouselItem[];
    onChange: (patch: Record<string, unknown>) => void;
  }) {
    const [params, setParams] = useState({ trunks: initial });
    return (
      <TrunkCarouselTrunksField
        params={params}
        onChange={(patch) => {
          setParams((prev) => ({ ...prev, ...patch }));
          onChange(patch);
        }}
      />
    );
  }

  it('serializes directory CallerID with original_caller and keep_original', () => {
    const onChange = vi.fn();
    render(
      <CarouselHarness
        initial={[{
          trunkId: 't_beta_100',
          callerId: { mode: 'static', value: '' },
          timeout: 45,
        }]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Источник CID'), { target: { value: 'directory' } });
    fireEvent.change(screen.getByLabelText('Справочник'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Поле записи'), { target: { value: '18' } });

    expect(onChange).toHaveBeenLastCalledWith({
      trunks: [{
        trunkId: 't_beta_100',
        callerId: {
          mode: 'directory',
          directoryUid: 7,
          valueFieldUid: 18,
          keySource: { source: 'original_caller' },
          onMissing: 'keep_original',
        },
        timeout: 45,
      }],
    });
  });

  it('shows read-only search key and fallback explanation', () => {
    render(
      <TrunkCarouselTrunksField
        params={{
          trunks: [{
            trunkId: 't_beta_100',
            callerId: {
              mode: 'directory',
              directoryUid: 7,
              valueFieldUid: 18,
              keySource: { source: 'original_caller' },
              onMissing: 'keep_original',
            },
            timeout: 45,
          }],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Ключ поиска: исходный CallerID')).toBeInTheDocument();
    expect(screen.getByText('Если данных нет: сохранить исходный CallerID')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });
});
