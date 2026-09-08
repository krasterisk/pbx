import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileImportButton } from './FileImportButton';

function renderButton(onFileSelect = vi.fn(), disabled = false) {
  render(
    <FileImportButton
      accept=".csv,text/csv"
      onFileSelect={onFileSelect}
      disabled={disabled}
      data-testid="import-button"
      inputTestId="import-input"
    >
      Import
    </FileImportButton>,
  );
  return onFileSelect;
}

describe('shared/ui/FileImportButton', () => {
  it('opens the hidden input from the visible button', () => {
    renderButton();
    const input = screen.getByTestId('import-input');
    const click = vi.spyOn(input, 'click');

    fireEvent.click(screen.getByTestId('import-button'));

    expect(click).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('accept', '.csv,text/csv');
    expect(input).toHaveAttribute('aria-hidden', 'true');
  });

  it('reports the picked file and clears the input so the same file fires again', () => {
    const onFileSelect = renderButton();
    const input = screen.getByTestId('import-input') as HTMLInputElement;
    const file = new File(['a;b'], 'rows.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelect).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });

  it('does nothing when the picker is dismissed', () => {
    const onFileSelect = renderButton();

    fireEvent.change(screen.getByTestId('import-input'), { target: { files: [] } });

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('disables only the visible button', () => {
    renderButton(vi.fn(), true);

    expect(screen.getByTestId('import-button')).toBeDisabled();
  });
});
