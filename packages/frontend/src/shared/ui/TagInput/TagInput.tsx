import { memo, useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * TagInput — chip-based multi-value input.
 *
 * Each tag is displayed as a removable chip. New tags are added via Enter key.
 * Backspace on empty input removes the last tag.
 *
 * FSD layer: shared/ui
 */
export const TagInput = memo(({ value, onChange, placeholder, disabled }: TagInputProps) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback((raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) return; // no duplicates
    onChange([...value, tag]);
    setInputValue('');
  }, [value, onChange]);

  const removeTag = useCallback((index: number) => {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
    }
  }, [inputValue, value, addTag, removeTag]);

  const handleWrapperClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-2 p-2 min-h-[40px]',
        'bg-background border border-input rounded-md shadow-sm',
        'focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-colors',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      onClick={handleWrapperClick}
    >
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-full select-none"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              className="inline-flex items-center justify-center p-0.5 ml-1 text-primary/60 hover:text-destructive hover:bg-destructive/10 rounded outline-none transition-colors"
              onClick={(e) => { e.stopPropagation(); removeTag(idx); }}
              tabIndex={-1}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        className="flex-1 min-w-[120px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm text-foreground placeholder:text-muted-foreground placeholder:text-xs py-0.5 px-0"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
      />
    </div>
  );
});

TagInput.displayName = 'TagInput';
