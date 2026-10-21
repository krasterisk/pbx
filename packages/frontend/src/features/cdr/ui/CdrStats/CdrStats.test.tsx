import { render, screen } from '@testing-library/react';
import { CdrStats } from './CdrStats';
import type { ICdrStats } from '@/shared/api/endpoints/cdrApi';

const stats: ICdrStats = { totalCalls: 0, asr: 0, avgBillsec: 0, avgPdd: 0, byDisposition: {} };

describe('CdrStats', () => {
  it('shows a dash instead of zero when the stats request failed', () => {
    render(<CdrStats isLoading={false} isError stats={undefined} />);

    expect(screen.getByText('Всего звонков').parentElement?.textContent).toContain('—');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('keeps a real zero when the period genuinely has no calls', () => {
    render(<CdrStats isLoading={false} stats={stats} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
