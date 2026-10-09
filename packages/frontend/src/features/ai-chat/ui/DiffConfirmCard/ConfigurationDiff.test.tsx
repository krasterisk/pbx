import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfigurationDiff } from './ConfigurationDiff';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
describe('ConfigurationDiff', () => {
  it('shows changed fields and excludes unchanged fields, identifiers and nested secrets', () => {
    render(<ConfigurationDiff before={{ allow: 'alaw', context: 'ctx100', advanced: { rtp_timeout: '20', password: 'old-secret' } }} after={{ allow: 'opus', context: 'ctx100', sipId: 'e201_100', advanced: { rtp_timeout: '60', password: 'new-secret' } }} />);
    expect(screen.getByText('alaw → opus')).toBeInTheDocument();
    expect(screen.getByText('20 → 60')).toBeInTheDocument();
    expect(screen.queryByText(/old-secret|new-secret|e201_100|ctx100/)).toBeNull();
  });
});
