import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrunkCarouselTrunksField } from './TrunkCarouselTrunksField';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: () => ({
    data: [
      { name: 'PJSIP/trunk1' },
      { name: 'PJSIP/trunk2' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: () => ({
    data: [
      { uid: 1, name: 'VIP Clients' },
      { uid: 2, name: 'Regional CID' },
    ],
    isLoading: false,
  }),
}));

describe('TrunkCarouselTrunksField', () => {
  it('renders add button and can add a new trunk row with default values', () => {
    const onChange = vi.fn();
    render(<TrunkCarouselTrunksField params={{ trunks: [] }} onChange={onChange} />);

    const addBtn = screen.getByRole('button', { name: /Добавить транк/i });
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn);
    expect(onChange).toHaveBeenCalledWith({
      trunks: [{ trunk: '', cid_mode: 'static', callerid: '', timeout: 60 }],
    });
  });

  it('renders trunk rows with trunk select, timeout, CID source, and static callerid input', () => {
    const onChange = vi.fn();
    render(
      <TrunkCarouselTrunksField
        params={{
          trunks: [
            { trunk: 'PJSIP/trunk1', cid_mode: 'static', callerid: '79001234567', timeout: 60 },
          ],
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Транк')).toHaveValue('PJSIP/trunk1');
    expect(screen.getByLabelText('Таймаут, сек')).toHaveValue(60);
    expect(screen.getByLabelText('Источник CID')).toHaveValue('static');
    expect(screen.getByLabelText('Номер CallerID')).toHaveValue('79001234567');
  });

  it('switches to phonebook select when CID mode is phonebook', () => {
    const onChange = vi.fn();
    render(
      <TrunkCarouselTrunksField
        params={{
          trunks: [
            { trunk: 'PJSIP/trunk2', cid_mode: 'phonebook', phonebook_uid: 2, timeout: 45 },
          ],
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Транк')).toHaveValue('PJSIP/trunk2');
    expect(screen.getByLabelText('Таймаут, сек')).toHaveValue(45);
    expect(screen.getByLabelText('Источник CID')).toHaveValue('phonebook');
    expect(screen.getByLabelText('Справочник')).toHaveValue('2');
  });

  it('calls onChange when modifying trunk or callerid', () => {
    const onChange = vi.fn();
    render(
      <TrunkCarouselTrunksField
        params={{
          trunks: [
            { trunk: 'PJSIP/trunk1', cid_mode: 'static', callerid: '', timeout: 60 },
          ],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Номер CallerID'), {
      target: { value: '74959998877' },
    });
    expect(onChange).toHaveBeenCalledWith({
      trunks: [
        { trunk: 'PJSIP/trunk1', cid_mode: 'static', callerid: '74959998877', timeout: 60 },
      ],
    });
  });
});
