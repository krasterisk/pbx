import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UploadForm } from './UploadForm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      return key;
    },
    i18n: { language: 'ru' },
  }),
}));

const projects = [
  { id: 'proj-1', name: 'Support' },
  { id: 'proj-2', name: 'Sales' },
];

const operators = [
  { id: 10, name: 'Иван ОченьДлинноеИмяОператораДляПереноса' },
];

function renderForm(overrides: Partial<ComponentProps<typeof UploadForm>> = {}) {
  const onSubmit = vi.fn(async () => undefined);
  const onOpenChange = vi.fn();
  const view = render(
    <UploadForm
      open
      onOpenChange={onOpenChange}
      projects={projects}
      operators={operators}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onOpenChange, ...view };
}

describe('UploadForm', () => {
  it('requires project and shows uploading busy label without channel swap', async () => {
    const user = userEvent.setup();
    const { onSubmit, rerender } = renderForm();

    expect(screen.getByTestId('upload-form')).toBeInTheDocument();
    expect(screen.queryByTestId('upload-channel-swap')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/swap|канал|channel/i)).not.toBeInTheDocument();

    const submit = screen.getByTestId('upload-submit');
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/проект|project/i), 'proj-1');
    expect(submit).toBeDisabled();

    const file = new File([new Uint8Array([1, 2, 3])], 'call.wav', { type: 'audio/wav' });
    await user.upload(screen.getByTestId('upload-file-input'), file);
    expect(screen.getByTestId('upload-submit')).not.toBeDisabled();

    rerender(
      <UploadForm
        open
        onOpenChange={vi.fn()}
        projects={projects}
        operators={operators}
        onSubmit={onSubmit}
        isSubmitting
      />,
    );
    expect(screen.getByTestId('upload-submit')).toHaveTextContent('Загрузка...');
    expect(screen.getByTestId('upload-submit')).toBeDisabled();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps one field set for single file and batch; pre-queue refusal stays in the form', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      formError: 'Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ.',
    });

    expect(screen.getByLabelText(/проект|project/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Оператор')).toBeInTheDocument();
    expect(screen.getByTestId('upload-form-error')).toHaveTextContent(/Не удалось загрузить файл/);

    await user.selectOptions(screen.getByLabelText(/проект|project/i), 'proj-1');
    const good = new File([new Uint8Array([1])], 'a.wav', { type: 'audio/wav' });
    const bad = new File([new Uint8Array([1])], 'b.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('upload-file-input'), {
      target: { files: [good, bad] },
    });

    expect(screen.getByTestId('upload-file-list')).toHaveTextContent('a.wav');
    expect(screen.getByTestId('upload-file-list')).toHaveTextContent('b.pdf');
    expect(screen.getAllByLabelText(/проект|project/i)).toHaveLength(1);

    await user.click(screen.getByTestId('upload-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-form-error')).toBeInTheDocument();
  });
});
