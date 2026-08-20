import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExtenApp } from './ExtenApp';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: () => ({
    data: [{ id: '1', extension: '101', callerid: 'Desk' }],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: () => ({ data: [], isLoading: false }),
}));

describe('ExtenApp', () => {
  it('renders the webrtc toggle with the Copywriting Contract name', () => {
    render(
      <ExtenApp
        params={{ target: { source: 'fixed', value: '101' }, webrtc: true }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Звонить на WebRTC')).toBeInTheDocument();
  });

  it('marks an empty required target aria-invalid before submit', () => {
    render(
      <ExtenApp
        params={{ target: { source: 'fixed', value: '' } }}
        onChange={vi.fn()}
      />,
    );
    expect(document.querySelector('[aria-invalid="true"]')).not.toBeNull();
  });
});
