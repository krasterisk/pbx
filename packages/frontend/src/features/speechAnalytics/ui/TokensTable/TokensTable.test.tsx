import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TokensTable, type SaApiTokenRow } from './TokensTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (defaultValue && typeof defaultValue === 'object' && 'defaultValue' in defaultValue) {
        return String((defaultValue as { defaultValue?: string }).defaultValue ?? key);
      }
      return key;
    },
    i18n: { language: 'ru' },
  }),
}));

const sampleTokens: SaApiTokenRow[] = [
  {
    principalId: 'p1',
    name: 'CRM bridge',
    projectId: 'proj-1',
    projectName: 'Support',
    lastUsed: '2026-09-21T10:00:00Z',
  },
];

function renderTable(overrides: Partial<ComponentProps<typeof TokensTable>> = {}) {
  const onIssue = vi.fn(async () => ({ secret: 'krint_v1_secret_once' }));
  const onRevoke = vi.fn(async () => undefined);
  const onRetry = vi.fn();
  const view = render(
    <TokensTable
      tokens={[]}
      canIssue
      moduleActive
      projects={[{ id: 'proj-1', name: 'Support' }]}
      onIssue={onIssue}
      onRevoke={onRevoke}
      onRetry={onRetry}
      {...overrides}
    />,
  );
  return { onIssue, onRevoke, onRetry, ...view };
}

describe('TokensTable', () => {
  it('shows empty copy and hides issue CTA for supervisor; secret dialog once', async () => {
    const user = userEvent.setup();
    const { rerender, onIssue } = renderTable({ tokens: [], canIssue: true });

    expect(screen.getByText('Токенов пока нет')).toBeInTheDocument();
    expect(screen.getByTestId('tokens-issue-cta')).toHaveTextContent('Выпустить токен');

    rerender(
      <TokensTable
        tokens={[]}
        canIssue={false}
        moduleActive
        projects={[{ id: 'proj-1', name: 'Support' }]}
        onIssue={onIssue}
      />,
    );
    expect(screen.getByText('Токенов пока нет')).toBeInTheDocument();
    expect(screen.queryByTestId('tokens-issue-cta')).not.toBeInTheDocument();

    rerender(
      <TokensTable
        tokens={[]}
        canIssue
        moduleActive
        projects={[{ id: 'proj-1', name: 'Support' }]}
        onIssue={onIssue}
      />,
    );
    await user.click(screen.getByTestId('tokens-issue-cta'));
    await user.type(screen.getByLabelText(/имя|name/i), 'CRM bridge');
    await user.selectOptions(screen.getByLabelText(/проект|project/i), 'proj-1');
    await user.click(screen.getByTestId('tokens-issue-submit'));

    expect(onIssue).toHaveBeenCalled();
    expect(screen.getByText('Сохраните секрет токена')).toBeInTheDocument();
    expect(screen.getByTestId('tokens-secret-once')).toHaveTextContent('krint_v1_secret_once');

    await user.click(screen.getByTestId('tokens-secret-close'));
    expect(screen.queryByTestId('tokens-secret-once')).not.toBeInTheDocument();
    expect(screen.queryByText('krint_v1_secret_once')).not.toBeInTheDocument();
  });

  it('shows skeleton, list error with retry, and read-only list when module is off', async () => {
    const user = userEvent.setup();
    const { rerender, onRetry } = renderTable({ isLoading: true, tokens: [] });
    expect(screen.getByTestId('tokens-table-loading')).toBeInTheDocument();

    rerender(
      <TokensTable
        tokens={[]}
        isError
        onRetry={onRetry}
        canIssue
        moduleActive
      />,
    );
    expect(screen.getByTestId('tokens-table-error')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /повторить|retry/i }));
    expect(onRetry).toHaveBeenCalled();

    rerender(
      <TokensTable
        tokens={sampleTokens}
        canIssue
        moduleActive={false}
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getByTestId('tokens-table')).toBeInTheDocument();
    expect(screen.getByText('CRM bridge')).toBeInTheDocument();
    expect(screen.queryByTestId('tokens-issue-cta')).not.toBeInTheDocument();
    expect(screen.getByTestId('tokens-revoke-p1')).toBeInTheDocument();
  });
});
