import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DEFAULT_AGENT_HOTKEYS } from '@krasterisk/shared';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback || key }) }));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetMyUiCustomizationQuery: () => ({ data: { ui_visibility: {}, locks: {} } }),
  useUpdateMyUiCustomizationMutation: () => [vi.fn()],
  useGetMyNotificationsQuery: () => ({ data: {} }), useUpdateMyNotificationsMutation: () => [vi.fn()],
}));
vi.mock('../NotificationMatrix', () => ({ NotificationMatrix: () => null }));
import { AgentPersonalSettings } from './AgentPersonalSettings';

describe('personal settings shortcuts tab', () => {
  it('opens shortcuts directly in the settings sheet and respects effective keys and SIP restrictions', () => {
    render(<AgentPersonalSettings open hideTrigger tab="hotkeys" sip hotkeyMap={{ ...DEFAULT_AGENT_HOTKEYS, hangup: 'Alt+KeyZ' }} />);
    expect(screen.getByRole('tab', { name: 'Hotkeys' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('agent-personal-settings-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-personal-settings-trigger')).toBeNull();
    expect(screen.getByText('Alt+Z')).toBeInTheDocument();
    expect(screen.getAllByText('On SIP phone')).toHaveLength(3);
  });
  it('exposes shortcuts as a tab from the gear alongside existing personal preferences', () => {
    render(<AgentPersonalSettings />);
    fireEvent.click(screen.getByTestId('agent-personal-settings-trigger'));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Hotkeys' }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('tab', { name: 'Hotkeys' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Alt+H')).toBeInTheDocument();
  });
});
