import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../CallCenterSettings', () => ({
  CallCenterSettings: () => <div data-testid="cc-personal-body" />,
}));

import { AgentPersonalSettings } from './AgentPersonalSettings';

describe('AgentPersonalSettings (U5.3)', () => {
  it('opens the personal settings sheet from the header trigger without any router or admin access', () => {
    render(<AgentPersonalSettings />);
    expect(screen.queryByTestId('cc-personal-body')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('agent-personal-settings-trigger'));
    expect(screen.getByTestId('cc-personal-body')).toBeInTheDocument();
  });
});
