import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StartCampaignDialog } from './StartCampaignDialog';
import type { AutodialCampaignWithSchedules } from '@/shared/api/endpoints/autodialApi';

const mocks = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useStartAutodialCampaignMutation: () => [mocks.start, { isLoading: false }],
}));

describe('StartCampaignDialog deployment failure', () => {
  it('keeps the dialog open and explains a failed PBX apply', async () => {
    const close = vi.fn();
    mocks.start.mockReturnValue({ unwrap: () => Promise.reject({ data: { code: 'AC_DIALPLAN_APPLY_FAILED' } }) });
    render(<StartCampaignDialog campaign={{ uid: 11, name: 'Test' } as AutodialCampaignWithSchedules} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.campaigns.start' }));
    expect(await screen.findByText('autodial.errors.AC_DIALPLAN_APPLY_FAILED')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
