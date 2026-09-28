import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_VOICE_ROBOT_DEFAULTS, type AiVoiceRobotConfig } from '@krasterisk/shared';
import { RobotEditor } from './RobotEditor';

const { save, unwrap } = vi.hoisted(() => ({ save: vi.fn(), unwrap: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/shared/api/endpoints/aiVoiceRobotsApi', () => ({ useSaveAiVoiceRobotMutation: () => [save, { isLoading: false }] }));
vi.mock('../RobotSettingsForm', () => ({ RobotSettingsForm: ({ value, onChange }: {
  value: AiVoiceRobotConfig; onChange: (value: AiVoiceRobotConfig) => void;
}) => <input aria-label="name" value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /> }));

const robot = { uid: 5, robotUuid: 'r', versionId: 'v', revision: 7, config: {
  ...structuredClone(AI_VOICE_ROBOT_DEFAULTS), name: 'Support', uniqueId: 'support', instruction: 'Help', modelProfileId: 1,
} };

describe('RobotEditor', () => {
  beforeEach(() => { vi.clearAllMocks(); unwrap.mockResolvedValue(robot); save.mockReturnValue({ unwrap }); });
  it('saves the complete local configuration with the revision originally read', async () => {
    const onClose = vi.fn();
    render(<RobotEditor robot={robot} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith({ uid: 5, revision: 7, config: { ...robot.config, name: 'Updated' } });
  });
  it('retains the draft on stale revision', async () => {
    unwrap.mockRejectedValue({ status: 409 });
    const onClose = vi.fn();
    render(<RobotEditor robot={robot} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('aiVoiceDesigner.stale');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('name')).toHaveValue('Support');
  });
  it('requires an explicit discard after editing', () => {
    const onClose = vi.fn();
    render(<RobotEditor robot={robot} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.keepEditing' }));
    expect(screen.getByLabelText('name')).toHaveValue('Unsaved');
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.discard' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('opens a copy without writing or reusing the source identity', () => {
    render(<RobotEditor robot={robot} copy onClose={vi.fn()} />);
    expect(screen.getByLabelText('name')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(save).not.toHaveBeenCalled();
  });
});
