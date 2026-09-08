import { forwardRef, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react';
import { Button, type ButtonProps } from '../Button';
import cls from './FileImportButton.module.scss';

export interface FileImportButtonProps extends Omit<ButtonProps, 'onSelect' | 'children'> {
  /** Native `accept` list, for example `.csv,text/csv`. */
  accept?: string;
  onFileSelect: (file: File) => void;
  children: ReactNode;
  inputTestId?: string;
}

/**
 * Wraps the native file input so feature code never has to render one.
 * The input is reset after every pick, so selecting the same file twice still fires.
 */
export const FileImportButton = forwardRef<HTMLButtonElement, FileImportButtonProps>(({
  accept,
  onFileSelect,
  children,
  inputTestId,
  disabled,
  ...buttonProps
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <>
      <Button ref={ref} type="button" disabled={disabled} onClick={openPicker} {...buttonProps}>
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={cls.input}
        data-testid={inputTestId}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
    </>
  );
});

FileImportButton.displayName = 'FileImportButton';
