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

function call(
  overrides: Partial<ICdrCall> & {
    hasVoicemail?: boolean;
    hasConferenceRecording?: boolean;
    journalConversationId?: string | null;
    speechAnalyticsActive?: boolean;
    routeProjectId?: string | null;
    companyPaused?: boolean;
  } = {},
): ICdrCall & {
  hasVoicemail?: boolean;
  hasConferenceRecording?: boolean;
  journalConversationId?: string | null;
  speechAnalyticsActive?: boolean;
  routeProjectId?: string | null;
  companyPaused?: boolean;
} {
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

describe('CdrTable conference recording icon (16.2-03 D-33)', () => {
  it('shows the conference button only when hasConferenceRecording and click skips voicemail', () => {
    const onVoicemailClick = vi.fn();
    const onConferenceClick = vi.fn();
    render(
      <CdrTable
        data={[call({ hasVoicemail: true, hasConferenceRecording: true })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
        onVoicemailClick={onVoicemailClick}
        onConferenceClick={onConferenceClick}
      />,
    );

    expect(screen.getByRole('button', { name: 'Прослушать запись' })).toBeInTheDocument();
    const conference = screen.getByRole('button', { name: 'Запись конференции' });
    expect(conference).toHaveAttribute('title', 'Запись конференции');
    fireEvent.click(conference);
    expect(onConferenceClick).toHaveBeenCalledWith('1693731234.12');
    expect(onVoicemailClick).not.toHaveBeenCalled();
  });

  it('does not show the conference button when the flag is false', () => {
    render(
      <CdrTable
        data={[call({ hasConferenceRecording: false })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Прослушать запись' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запись конференции' })).not.toBeInTheDocument();
  });
});

describe('CdrTable speech analytics actions (D-05, D-16, D-18, D-19)', () => {
  it('hides Аналитика without a journal row and hides Получить аналитику without a recording', () => {
    render(
      <CdrTable
        data={[call({
          hasRecording: false,
          record: null,
          recordingUrl: null,
          journalConversationId: null,
          speechAnalyticsActive: true,
        })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Прослушать запись' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Аналитика' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Получить аналитику' })).not.toBeInTheDocument();
  });

  it('shows Аналитика when a journal row exists and keeps the CDR player', () => {
    const onOpenAnalytics = vi.fn();
    render(
      <CdrTable
        data={[call({
          journalConversationId: 'conv-1',
          speechAnalyticsActive: true,
        })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
        onOpenAnalytics={onOpenAnalytics}
      />,
    );

    expect(screen.getByRole('button', { name: 'Прослушать запись' })).toBeInTheDocument();
    const analytics = screen.getByRole('button', { name: 'Аналитика' });
    fireEvent.click(analytics);
    expect(onOpenAnalytics).toHaveBeenCalledWith('conv-1');
  });

  it('shows Получить аналитику when recording exists and module is active, even if company is paused', () => {
    const onGetAnalytics = vi.fn();
    render(
      <CdrTable
        data={[call({
          hasRecording: true,
          speechAnalyticsActive: true,
          companyPaused: true,
          routeProjectId: 'proj-1',
        })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
        onGetAnalytics={onGetAnalytics}
      />,
    );

    const getBtn = screen.getByRole('button', { name: 'Получить аналитику' });
    fireEvent.click(getBtn);
    expect(onGetAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ uniqueid: '1693731234.12', projectId: 'proj-1' }),
    );
  });

  it('asks for a project before starting when the route has no project', () => {
    const onGetAnalytics = vi.fn();
    render(
      <CdrTable
        data={[call({
          hasRecording: true,
          speechAnalyticsActive: true,
          routeProjectId: null,
        })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
        onGetAnalytics={onGetAnalytics}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Получить аналитику' }));
    expect(screen.getByText('Выберите проект аналитики')).toBeInTheDocument();
    expect(onGetAnalytics).not.toHaveBeenCalled();
  });

  it('hides Получить аналитику when the module is inactive', () => {
    render(
      <CdrTable
        data={[call({
          hasRecording: true,
          speechAnalyticsActive: false,
        })]}
        isLoading={false}
        totalRows={1}
        currentPage={0}
        pageSize={50}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Получить аналитику' })).not.toBeInTheDocument();
  });
});
