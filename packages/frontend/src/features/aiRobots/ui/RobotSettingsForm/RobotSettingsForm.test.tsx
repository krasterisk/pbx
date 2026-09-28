import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AI_VOICE_ROBOT_DEFAULTS, type AiVoiceRobotConfig } from '@krasterisk/shared';
import { RobotSettingsForm } from './RobotSettingsForm';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({ useGetAiProvidersQuery: () => ({ data: [
  { uid: 1, name: 'Realtime', vendor: 'openai', enabled: true, capabilities: ['realtime'] },
  { uid: 2, name: 'Local LLM', vendor: 'local', enabled: true, capabilities: ['llm'] },
  { uid: 3, name: 'Disabled', vendor: 'openai', enabled: false, capabilities: ['realtime'] },
] }) }));
vi.mock('../../api/aiToolsApi', () => ({ useGetAiToolsQuery: () => ({ data: [] }), useGetKnowledgeBasesQuery: () => ({ data: [] }) }));

function Form() {
  const [value, onChange] = useState<AiVoiceRobotConfig>({ ...structuredClone(AI_VOICE_ROBOT_DEFAULTS), modelProfileId: 1 });
  return <RobotSettingsForm value={value} onChange={onChange} />;
}

describe('RobotSettingsForm', () => {
  it('starts with prompt and opens only the selected section', () => {
    render(<Form />);
    expect(screen.getByLabelText('aiVoiceDesigner.instruction *')).toBeInTheDocument();
    expect(screen.queryByLabelText('aiVoiceDesigner.temperature')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.parameters' }));
    expect(screen.queryByLabelText('aiVoiceDesigner.instruction *')).not.toBeInTheDocument();
    expect(screen.getByLabelText('aiVoiceDesigner.name *')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'marin' })).toBeInTheDocument();
  });
  it('filters provider choices by enabled state and pipeline capability', () => {
    render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.pipeline' }));
    expect(screen.getByRole('option', { name: 'Realtime (openai)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Local LLM (local)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Disabled (openai)' })).not.toBeInTheDocument();
  });
  it('opens and focuses the first invalid field', () => {
    render(<RobotSettingsForm value={structuredClone(AI_VOICE_ROBOT_DEFAULTS)} onChange={vi.fn()}
      issues={[{ field: 'name', code: 'required' }]} />);
    expect(screen.getByLabelText('aiVoiceDesigner.name *')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('aiVoiceDesigner.required');
  });
  it('keeps edited prompt in local form state across section switches', () => {
    render(<Form />);
    fireEvent.change(screen.getByLabelText('aiVoiceDesigner.instruction *'), { target: { value: 'Saved locally' } });
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.parameters' }));
    fireEvent.click(screen.getByRole('button', { name: 'aiVoiceDesigner.prompt' }));
    expect(screen.getByLabelText('aiVoiceDesigner.instruction *')).toHaveValue('Saved locally');
  });
});
