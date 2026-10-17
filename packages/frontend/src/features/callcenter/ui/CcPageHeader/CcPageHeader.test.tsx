import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button, Text } from '@/shared/ui';
import { CcPageHeader } from './CcPageHeader';

describe('CcPageHeader (U0.3)', () => {
  it('renders h1 title, description tooltip trigger, data state pill, context and actions', () => {
    render(
      <CcPageHeader
        title="Панель супервизора"
        description="Мониторинг колл-центра в реальном времени"
        data="live"
        context={<Text data-testid="ctx">Все очереди</Text>}
        actions={<Button size="sm">Действие</Button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Панель супервизора' })).toBeInTheDocument();
    expect(screen.getByTestId('cc-page-header-info')).toBeInTheDocument();
    expect(screen.getByTestId('cc-page-header-status')).toHaveAttribute('data-state', 'live');
    expect(screen.getByTestId('ctx')).toHaveTextContent('Все очереди');
    expect(screen.getByRole('button', { name: 'Действие' })).toBeInTheDocument();
  });

  it('omits optional slots when not provided', () => {
    render(<CcPageHeader title="Настройки КЦ" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Настройки КЦ' })).toBeInTheDocument();
    expect(screen.queryByTestId('cc-page-header-info')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cc-page-header-status')).not.toBeInTheDocument();
  });
});
