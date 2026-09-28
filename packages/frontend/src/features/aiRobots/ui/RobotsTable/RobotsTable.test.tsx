import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AI_VOICE_ROBOT_DEFAULTS, type AiVoiceRobot } from '@krasterisk/shared';
import { RobotsTable } from './RobotsTable';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/aiVoiceRobotsApi', () => ({ useGetAiVoiceRobotsQuery: () => ({ data: [
  { uid: 1, revision: 2, robotUuid: 'r', versionId: 'v', config: { ...AI_VOICE_ROBOT_DEFAULTS, name: 'Support' } },
] }) }));
vi.mock('../RobotEditor', () => ({ RobotEditor: ({ robot, copy }: { robot?: AiVoiceRobot; copy?: boolean }) =>
  <output data-testid="editor">{robot?.uid ?? 'new'}:{copy ? 'copy' : 'edit'}</output> }));

describe('RobotsTable', () => {
  it('creates through an empty local editor', () => {
    render(<RobotsTable />);
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.create' }));
    expect(screen.getByTestId('editor')).toHaveTextContent('new:edit');
  });
  it('opens a copy in the editor instead of immediately persisting it', () => {
    render(<RobotsTable />);
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.copy' }));
    expect(screen.getByTestId('editor')).toHaveTextContent('1:copy');
  });
  it('filters the list by name', () => {
    render(<RobotsTable />);
    fireEvent.change(screen.getByRole('textbox', { name: 'aiVoiceDesigner.search' }), { target: { value: 'absent' } });
    expect(screen.queryByText('Support')).not.toBeInTheDocument();
  });
});
