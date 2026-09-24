import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const previewTts = vi.hoisted(() => vi.fn());

vi.mock('@/shared/api/endpoints/aiAgentsApi', () => ({
  useCreateAiProviderMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateAiProviderMutation: () => [vi.fn(), { isLoading: false }],
  useCreateGlobalAiProviderMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateGlobalAiProviderMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  usePreviewPromptTtsMutation: () => [previewTts, { isLoading: false }],
}));

import { AiProviderModal } from './AiProviderModal';

describe('AiProviderModal', () => {
  it('keeps a single capability so synthesis and recognition settings stay apart', () => {
    render(<AiProviderModal provider={null} onClose={vi.fn()} />);
    const type = screen.getByLabelText('aiProviders.field.capabilities');
    expect(type.tagName).toBe('SELECT');
    expect(type).toHaveValue('llm');
    expect(screen.getByLabelText('aiProviders.field.model')).toBeInTheDocument();

    fireEvent.change(type, { target: { value: 'tts' } });
    expect(screen.queryByLabelText('aiProviders.field.model')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('aiProviders.field.vendor'), { target: { value: 'yandex' } });
    expect(screen.getByLabelText('ttsEngines.yandex.voice')).toBeInTheDocument();
    expect(screen.queryByLabelText('sttEngines.yandex.languageCode')).not.toBeInTheDocument();

    fireEvent.change(type, { target: { value: 'stt' } });
    expect(screen.queryByLabelText('ttsEngines.yandex.voice')).not.toBeInTheDocument();
    expect(screen.getByLabelText('sttEngines.yandex.languageCode')).toBeInTheDocument();
    expect(screen.queryByLabelText('aiProviders.field.model')).not.toBeInTheDocument();
  });

  it('shows a token for bearer, nothing for none, and header rows for custom', () => {
    render(<AiProviderModal provider={null} onClose={vi.fn()} />);
    expect(screen.getByLabelText('aiProviders.field.apiKey')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('aiProviders.field.authType'), { target: { value: 'none' } });
    expect(screen.queryByLabelText('aiProviders.field.apiKey')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('aiProviders.field.authType'), { target: { value: 'custom' } });
    expect(screen.getByLabelText('webhookAuth.headerKey')).toBeInTheDocument();
    expect(screen.getByLabelText('webhookAuth.headerValue')).toBeInTheDocument();
    expect(screen.queryByLabelText('aiProviders.field.apiKey')).not.toBeInTheDocument();
  });

  it('opens a create form with user-facing fields', () => {
    render(<AiProviderModal provider={null} onClose={vi.fn()} />);
    expect(screen.getByText('aiAgents.createProvider')).toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.name *')).toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.apiKey')).toBeInTheDocument();
  });

  it('shows the Yandex SpeechKit address, voice and a stored key', () => {
    render(
      <AiProviderModal
        scope="global"
        onClose={vi.fn()}
        provider={{
          uid: 64,
          name: 'Yandex TTS',
          kind: 'online',
          vendor: 'yandex',
          endpoint: '',
          auth_type: 'none',
          has_key: true,
          capabilities: ['tts'],
          defaults: { voice: 'jane', emotion: 'neutral', speed: '1.2' },
          enabled: true,
          user_uid: 0,
        }}
      />,
    );
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toHaveValue('https://tts.api.cloud.yandex.net');
    expect(screen.queryByRole('button', { name: 'aiProviders.extra' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('aiProviders.field.inputTokenUsd')).not.toBeInTheDocument();
    expect(screen.getByLabelText('ttsEngines.yandex.voice')).toHaveValue('jane');
    expect(screen.getByLabelText('ttsEngines.yandex.role')).toHaveValue('neutral');
    expect(screen.getByLabelText('ttsEngines.yandex.speed')).toHaveValue(1.2);
    expect(screen.getByLabelText('aiProviders.field.apiKey')).toHaveAttribute(
      'placeholder',
      'aiProviders.field.apiKeyStored',
    );
    expect(screen.queryByText('aiProviders.field.apiKeyStored')).not.toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.vendor')).toHaveValue('yandex');
    expect(screen.getByRole('option', { name: 'ttsEngines.yandex.voiceMadirus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aiProviders.field.listen' })).toBeEnabled();
  });

  it('switches Yandex and Google presets when the speech provider changes', () => {
    render(<AiProviderModal provider={null} requiredCapability="tts" onClose={vi.fn()} />);
    const providerSelect = screen.getByLabelText('aiProviders.field.vendor');
    expect(providerSelect.tagName).toBe('SELECT');
    expect(screen.queryByRole('button', { name: 'aiProviders.field.capLlm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'aiProviders.field.capRealtime' })).not.toBeInTheDocument();

    fireEvent.change(providerSelect, { target: { value: 'yandex' } });
    expect(screen.getByLabelText('ttsEngines.yandex.voice')).toHaveValue('alena');
    expect(screen.getByLabelText('ttsEngines.yandex.role')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aiProviders.field.listen' })).toBeDisabled();
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toHaveValue('https://tts.api.cloud.yandex.net');

    fireEvent.change(providerSelect, { target: { value: 'google' } });
    expect(screen.getByLabelText('ttsEngines.google.voiceName')).toHaveValue('ru-RU-Wavenet-A');
    expect(screen.getByRole('option', { name: 'ru-RU-Wavenet-A (Женский)' })).toBeInTheDocument();
    expect(screen.queryByLabelText('ttsEngines.yandex.role')).not.toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toHaveValue('https://texttospeech.googleapis.com');
  });

  it('shows the Google and Yandex recognition presets', () => {
    render(<AiProviderModal provider={null} requiredCapability="stt" onClose={vi.fn()} />);
    const providerSelect = screen.getByLabelText('aiProviders.field.vendor');

    expect(screen.queryByRole('button', { name: 'aiProviders.field.capLlm' })).not.toBeInTheDocument();
    fireEvent.change(providerSelect, { target: { value: 'yandex' } });
    expect(screen.getByRole('option', { name: 'Автоопределение (auto)' })).toBeInTheDocument();
    expect(screen.getByLabelText('sttEngines.yandex.eouSensitivity')).toHaveValue('DEFAULT');
    expect(screen.queryByRole('button', { name: 'aiProviders.field.listen' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toHaveValue('https://stt.api.cloud.yandex.net');

    fireEvent.change(providerSelect, { target: { value: 'google' } });
    expect(screen.getByRole('option', { name: 'Phone Call' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Command & Search' })).toBeInTheDocument();
    expect(screen.queryByLabelText('sttEngines.yandex.eouSensitivity')).not.toBeInTheDocument();
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toHaveValue('https://speech.googleapis.com');
  });

  it('plays the selected voice through the saved engine', async () => {
    previewTts.mockReturnValue({
      unwrap: () => Promise.resolve(new Blob(['wav'], { type: 'audio/wav' })),
    });
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Audio', class {
      src = '';
      onended: (() => void) | null = null;
      play = play;
      pause() {}
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(
      <AiProviderModal
        onClose={vi.fn()}
        provider={{
          uid: 64,
          name: 'Yandex TTS',
          kind: 'online',
          vendor: 'yandex',
          endpoint: 'https://tts.api.cloud.yandex.net',
          auth_type: 'bearer',
          has_key: true,
          capabilities: ['tts'],
          defaults: { voice: 'jane', role: 'neutral', speed: '1.0', pitch_shift: '0' },
          enabled: true,
          user_uid: 0,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'aiProviders.field.listen' }));
    await waitFor(() => {
      expect(previewTts).toHaveBeenCalledWith({
        text: 'Проверка синтеза',
        engine_uid: 64,
        settings: {
          voice: 'jane',
          role: 'neutral',
          speed: '1.0',
          pitch_shift: '0',
        },
      });
      expect(play).toHaveBeenCalled();
    });
  });

  it('does not send a role the Yandex voice rejects', async () => {
    render(
      <AiProviderModal
        onClose={vi.fn()}
        provider={{
          uid: 64,
          name: 'Yandex TTS',
          kind: 'online',
          vendor: 'yandex',
          endpoint: 'https://tts.api.cloud.yandex.net',
          auth_type: 'bearer',
          has_key: true,
          capabilities: ['tts'],
          defaults: { voice: 'filipp', role: 'neutral', speed: '1.0', pitch_shift: '0' },
          enabled: true,
          user_uid: 0,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('ttsEngines.yandex.role')).toHaveValue('');
    });
    fireEvent.click(screen.getByRole('button', { name: 'aiProviders.field.listen' }));
    await waitFor(() => {
      expect(previewTts).toHaveBeenCalledWith(expect.objectContaining({
        settings: expect.objectContaining({ voice: 'filipp', role: '' }),
      }));
    });
  });

  it('keeps a custom speech connection on the card with a free-text voice', () => {
    render(<AiProviderModal provider={null} requiredCapability="tts" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('aiProviders.field.vendor'), { target: { value: 'other' } });

    const voice = screen.getByLabelText('ttsEngines.yandex.voice');
    expect(voice.tagName).toBe('INPUT');
    expect(voice).toHaveValue('');
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toHaveValue('');
    expect(screen.getByLabelText('aiProviders.field.authType')).toBeInTheDocument();
    expect(screen.queryByLabelText('ttsEngines.yandex.role')).not.toBeInTheDocument();

    fireEvent.change(voice, { target: { value: 'alloy' } });
    expect(voice).toHaveValue('alloy');
  });

  it('opens a saved custom engine without Yandex voice defaults', () => {
    render(
      <AiProviderModal
        onClose={vi.fn()}
        provider={{
          uid: 9,
          name: 'Piper',
          kind: 'custom',
          vendor: 'piper',
          endpoint: 'http://127.0.0.1:5000/api/tts',
          auth_type: 'none',
          has_key: false,
          capabilities: ['tts'],
          defaults: {},
          enabled: true,
          user_uid: 1,
        }}
      />,
    );
    expect(screen.getByLabelText('aiProviders.field.vendor')).toHaveValue('other');
    expect(screen.getByLabelText('aiProviders.field.speechVendorName')).toHaveValue('piper');
    expect(screen.getByLabelText('ttsEngines.yandex.voice')).toHaveValue('');
    expect(screen.getByLabelText('aiProviders.field.endpoint *')).toHaveValue('http://127.0.0.1:5000/api/tts');
    expect(screen.getByRole('button', { name: 'aiProviders.field.listen' })).toBeEnabled();
  });
});
