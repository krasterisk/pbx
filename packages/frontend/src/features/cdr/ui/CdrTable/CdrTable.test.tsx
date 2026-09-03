import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ICdrCall } from '@/shared/api/endpoints/cdrApi';
import { CdrTable } from './CdrTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    RecordingButton: () => (
      <button type="button" title="Прослушать запись" aria-label="Прослушать запись">
        Mic
      </button>
    ),
  };
});

function call(overrides: Partial<ICdrCall> & { hasVoicemail?: boolean } = {}): ICdrCall & { hasVoicemail?: boolean } {
  return {
    linkedid: 'lid-1',
    uniqueid: '1693731234.12',
    calldate: '2026-09-03 10:00:00',
    clid: '79001234567',
    src: '79001234567',
    usrc: '79001234567',
    dst: '100',
    dialednum: '100',
    disposition: 'ANSWERED',
    dstchannel: '',
    duration: 12,
    billsec: 12,
    record: 'rec.mp3',
    transid: null,
    dcontext: 'from-internal',
    legCount: 1,
    answered: true,
    direction: 'in',
    srcDisplay: '79001234567',
    dstDisplay: '100',
    recordingUrl: '/reports/cdr/recording/1693731234.12/play',
    hasRecording: true,
    ...overrides,
  };
}

describe('CdrTable journal voicemail icon (Surface L)', () => {
  it('keeps RecordingButton for conversation and adds a Voicemail details icon', () => {
    const onVoicemailClick = vi.fn();
    render(
      <CdrTable
        data={[call({ hasVoicemail: true })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
        onVoicemailClick={onVoicemailClick}
      />,
    );

    expect(screen.getByRole('button', { name: 'Прослушать запись' })).toBeInTheDocument();
    const details = screen.getByRole('button', { name: 'Детали сообщения' });
    expect(details).toHaveAttribute('title', 'Детали сообщения');
    fireEvent.click(details);
    expect(onVoicemailClick).toHaveBeenCalledWith('1693731234.12');
    expect(document.body.textContent).not.toMatch(/\/voicemail\/play\?token=/);
  });

  it('does not show the Voicemail icon when the row has no voicemail', () => {
    render(
      <CdrTable
        data={[call({ hasVoicemail: false })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Прослушать запись' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Детали сообщения' })).not.toBeInTheDocument();
  });
});
