import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { IEndpointListItem } from '@krasterisk/shared';
import { EndpointStatus } from './EndpointStatus';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }) }));
describe('EndpointStatus', () => {
  it('shows the primary and browser registration independently', () => {
    render(<EndpointStatus endpoint={{ status: 'offline', lastRegistered: null, webrtc_enabled: true, webrtc: { id: 'ew100', status: 'online' } } as IEndpointListItem} />);
    expect(screen.getByText('endpoints.statusOffline')).toBeInTheDocument();
    expect(screen.getByText('endpoints.credWebrtc')).toBeInTheDocument();
    expect(screen.getByTitle('ew100')).toBeInTheDocument();
  });
});
