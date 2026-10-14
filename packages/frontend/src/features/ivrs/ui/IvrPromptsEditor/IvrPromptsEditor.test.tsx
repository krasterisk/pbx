import { useState } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IIvrPhrase } from '@krasterisk/shared';
import { IvrPromptsEditor } from './IvrPromptsEditor';

const reorder = vi.hoisted(() => ({
  ids: [] as string[],
  apply: undefined as undefined | ((ids: string[]) => void),
}));
vi.mock('@/shared/ui/SortableRegion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui/SortableRegion')>();
  return {
    ...actual,
    SortableRegion: (props: Parameters<typeof actual.SortableRegion>[0]) => {
      reorder.ids = props.ids;
      reorder.apply = props.onReorder;
      return <actual.SortableRegion {...props} />;
    },
  };
});

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-toastify', () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));
vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({
    data: [{ uid: 1, filename: 'greeting.wav', comment: 'Greeting' }],
  }),
}));
vi.mock('@/shared/api/endpoints/ttsEnginesApi', () => ({
  useGetTtsEnginesQuery: () => ({
    data: [{ uid: 2, name: 'Speech', type: 'openai', settings: { voice: 'alloy', model: 'tts-1' } }],
  }),
}));
vi.mock('@/shared/api/endpoints/ivrsApi', () => ({
  usePreviewIvrTtsMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('../IvrPhraseTtsFields/IvrPhraseTtsFields', () => ({ IvrPhraseTtsFields: () => null }));

function Draft({ initial }: { initial: IIvrPhrase[] }) {
  const [phrases, setPhrases] = useState(initial);
  return <IvrPromptsEditor value={phrases} onChange={setPhrases} />;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

describe('IVR phrase card', () => {
  it('starts collapsed and keeps TTS edits through collapse', () => {
    render(<Draft initial={[{ kind: 'tts', text: 'Hello', engine_uid: 2 }]} />);
    expect(screen.queryByRole('textbox', { name: 'ivrs.editor.text' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.change(screen.getByRole('textbox', { name: 'ivrs.editor.text' }), {
      target: { value: 'Привет' },
    });
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByRole('textbox', { name: 'ivrs.editor.text' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('textbox', { name: 'ivrs.editor.text' })).toHaveValue('Привет');
  });

  it('deletes the phrase without toggling its settings', () => {
    render(<Draft initial={[{ kind: 'audio', filename: 'greeting.wav' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.delete: 1' }));
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
    expect(screen.getByText('ivrs.prompts.emptyMixed')).toBeInTheDocument();
  });

  it('shows the recording file only after opening its card', () => {
    render(<Draft initial={[{ kind: 'audio', filename: 'greeting.wav' }]} />);
    expect(screen.queryByRole('textbox', { name: 'ivrs.editor.filename' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('textbox', { name: 'ivrs.editor.filename' })).toHaveValue('greeting.wav');
  });
  it('preserves phrase identity and its edits when the sorting callback moves it', () => {
    render(
      <Draft
        initial={[
          { kind: 'audio', filename: 'greeting.wav' },
          { kind: 'tts', text: 'Hello', engine_uid: 2 },
        ]}
      />,
    );
    const original = [...reorder.ids];
    act(() => reorder.apply?.([...original].reverse()));
    const cards = screen.getAllByRole('button', { expanded: false });
    expect(cards[0]).toHaveTextContent('Hello');
    expect(cards[1]).toHaveTextContent('Greeting');
    fireEvent.click(cards[0]);
    fireEvent.change(screen.getByRole('textbox', { name: 'ivrs.editor.text' }), {
      target: { value: 'Changed after reorder' },
    });
    expect(screen.getByRole('textbox', { name: 'ivrs.editor.text' })).toHaveValue('Changed after reorder');
    expect(screen.getByText('Greeting')).toBeInTheDocument();
  });
});
