import { memo, useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  digitsOnly?: boolean;
  maxTagLength?: number;
  minTagLength?: number;
  invalidMessage?: string;
  maxTags?: number;
  removeLabel?: (tag: string) => string;
  'aria-label'?: string;
}

/**
 * TagInput - chip-based multi-value input.
 *
 * Each tag is displayed as a removable chip. New tags are added via Enter key.
 * Backspace on empty input removes the last tag.
 *
 * FSD layer: shared/ui
 */
export const TagInput = memo(
  ({
    value,
    onChange,
    placeholder,
    disabled,
    digitsOnly,
    maxTagLength,
    minTagLength,
    invalidMessage,
    maxTags,
    removeLabel,
    'aria-label': ariaLabel,
  }: TagInputProps) => {
    const [inputValue, setInputValue] = useState('');
    const [invalid, setInvalid] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const addTag = useCallback(
      (raw: string) => {
        if (!raw.trim()) {
          setInputValue('');
          return;
        }

        const parts = raw
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        if (
          digitsOnly &&
          parts.some(
            (part) =>
              !/^\d+$/.test(part) ||
              part.length > (maxTagLength ?? 11) ||
              part.length < (minTagLength ?? 1),
          )
        ) {
          setInvalid(true);
          return;
        }
        if (!parts.length) {
          setInputValue('');
          return;
        }

        const newTags = [...new Set(parts)].filter(
          (tag) => !value.includes(tag),
        );
        if (maxTags !== undefined && value.length + newTags.length > maxTags) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        if (newTags.length > 0) {
          onChange([...value, ...newTags]);
        }
        setInputValue('');
      },
      [value, onChange, digitsOnly, maxTagLength, minTagLength, maxTags],
    );

    const removeTag = useCallback(
      (index: number) => {
        setInvalid(false);
        const next = [...value];
        next.splice(index, 1);
        onChange(next);
      },
      [value, onChange],
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          addTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
          removeTag(value.length - 1);
        }
      },
      [inputValue, value, addTag, removeTag],
    );

    const handleWrapperClick = useCallback(() => {
      inputRef.current?.focus();
    }, []);

    return (
      <div
        className={clsx(
          'flex flex-wrap items-center gap-2 p-2 min-h-[40px] w-full min-w-0 max-w-full box-border',
          'bg-background border border-input rounded-md shadow-sm',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring focus-within:border-transparent',
          'transition-all duration-200',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={handleWrapperClick}
      >
        {value.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 max-w-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-full select-none"
          >
            <button
              type="button"
              className="bg-transparent border-none p-0 text-inherit cursor-text min-w-0 max-w-full truncate"
              title={digitsOnly ? undefined : 'Изменить'}
              disabled={disabled || digitsOnly}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                setInputValue(tag);
                removeTag(idx);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              {tag}
            </button>
            {!disabled && (
              <button
                type="button"
                className="inline-flex items-center justify-center p-0.5 ml-1 text-primary/60 hover:text-destructive hover:bg-destructive/10 rounded outline-none transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(idx);
                }}
                aria-label={removeLabel?.(tag) || `Remove ${tag}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          className="flex-1 min-w-[4rem] w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm text-foreground placeholder:text-muted-foreground placeholder:text-xs py-0.5 px-0"
          value={inputValue}
          aria-invalid={invalid}
          inputMode={digitsOnly ? 'numeric' : undefined}
          maxLength={maxTagLength}
          onChange={(e) => {
            const val = e.target.value;
            setInvalid(false);
            if (digitsOnly && !/^[\d,]*$/.test(val)) return;
            if (val.includes(',')) {
              addTag(val);
            } else {
              setInputValue(val);
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          aria-label={ariaLabel}
        />
        {invalid && invalidMessage && (
          <p role="alert" className="text-sm text-destructive w-full">
            {invalidMessage}
          </p>
        )}
      </div>
    );
  },
);

TagInput.displayName = 'TagInput';
