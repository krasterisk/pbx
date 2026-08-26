import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Check } from 'lucide-react';
import cls from './MultiSelect.module.scss';

/**
 * Portal z-index must be above Radix Dialog overlay/content (z-50 = 50).
 * @theme CSS variables are not accessible in SCSS modules, so we use a constant.
 * Matches globals.css --z-index-popover conceptually.
 */
const PORTAL_Z_INDEX = 9999;

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface MultiSelectProps {
  /** Currently selected option values */
  value: string[];
  /** Called with the updated selection */
  onChange: (value: string[]) => void;
  /** Available options */
  options: MultiSelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Optional className */
  className?: string;
  /** Filter options by typing (default false). */
  searchable?: boolean;
  /** Placeholder for the dropdown search field. */
  searchPlaceholder?: string;
}

/**
 * Multi-select with tags and dropdown checklist.
 * Selected items appear as removable tags at the top.
 * Dropdown shows checkboxes for each option.
 * Rendered via createPortal to evade modal boundary overflow issues.
 *
 * When searchable, the filter input lives in the trigger (inside Dialog focus
 * scope) so Radix focus-trap does not steal keystrokes from a body portal.
 */
export const MultiSelect = memo(({
  value,
  onChange,
  options,
  placeholder,
  className,
  searchable = false,
  searchPlaceholder,
}: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selected = value;

  const updateDropdownPosition = useCallback(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: PORTAL_Z_INDEX,
        pointerEvents: 'auto',
      });
    }
  }, [isOpen]);

  useEffect(() => {
    updateDropdownPosition();
    if (isOpen) {
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      if (searchable) {
        // Focus after portal paint; keep inside trigger (Dialog scope).
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
    setQuery('');
  }, [isOpen, updateDropdownPosition, searchable]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const dropdown = dropdownRef.current;
    const stopProp = (e: Event) => {
      e.stopPropagation();
    };
    if (dropdown) {
      dropdown.addEventListener('mousedown', stopProp);
      dropdown.addEventListener('pointerdown', stopProp);
      dropdown.addEventListener('touchstart', stopProp);
      dropdown.addEventListener('wheel', stopProp);
      dropdown.addEventListener('touchmove', stopProp);
    }

    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);

    return () => {
      document.removeEventListener('mousedown', handler);
      if (dropdown) {
        dropdown.removeEventListener('mousedown', stopProp);
        dropdown.removeEventListener('pointerdown', stopProp);
        dropdown.removeEventListener('touchstart', stopProp);
        dropdown.removeEventListener('wheel', stopProp);
        dropdown.removeEventListener('touchmove', stopProp);
      }
    };
  }, [isOpen]);

  const toggle = useCallback((val: string) => {
    const next = selected.includes(val)
      ? selected.filter(s => s !== val)
      : [...selected, val];
    onChange(next);
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [selected, onChange, searchable]);

  const remove = useCallback((val: string) => {
    onChange(selected.filter(s => s !== val));
  }, [selected, onChange]);

  const clearAll = useCallback(() => onChange([]), [onChange]);

  const getLabel = (val: string) => {
    const opt = options.find(o => o.value === val);
    return opt ? opt.label : val;
  };

  const filteredOptions = (() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.value} ${opt.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  })();

  const openDropdown = () => {
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`${cls.container} ${className || ''}`}>
      <div
        ref={triggerRef}
        className={`${cls.trigger} ${isOpen ? cls.triggerOpen : ''}`}
        onClick={() => {
          if (searchable) {
            openDropdown();
            requestAnimationFrame(() => searchRef.current?.focus());
            return;
          }
          setIsOpen((prev) => !prev);
        }}
      >
        <div className={cls.tagsArea}>
          {selected.map(val => {
            const label = getLabel(val);
            return (
              <span key={val} className={cls.tag}>
                <span className={cls.tagLabel} title={label}>{label}</span>
                <button
                  type="button"
                  className={cls.tagRemove}
                  onClick={e => { e.stopPropagation(); remove(val); }}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          {searchable && isOpen ? (
            <input
              ref={searchRef}
              type="text"
              className={cls.searchInline}
              value={query}
              placeholder={selected.length === 0 ? (searchPlaceholder || placeholder || 'Search...') : (searchPlaceholder || '')}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') e.preventDefault();
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
            />
          ) : selected.length === 0 ? (
            <span className={cls.placeholder}>{placeholder || 'Select...'}</span>
          ) : null}
        </div>
        <div className={cls.actions}>
          {selected.length > 0 && (
            <button
              type="button"
              className={cls.clearBtn}
              onClick={e => { e.stopPropagation(); clearAll(); }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            className={cls.chevronBtn}
            aria-label={isOpen ? 'Close' : 'Open'}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
          >
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={cls.dropdown}
          style={dropdownStyle}
          data-multiselect-dropdown=""
          onWheel={(e) => {
            if (dropdownRef.current) {
              dropdownRef.current.scrollTop += e.deltaY;
            }
          }}
        >
          {filteredOptions.length === 0 ? (
            <div className={cls.empty}>{query.trim() ? '-' : (placeholder || 'Select...')}</div>
          ) : filteredOptions.map(opt => {
            const isChecked = selected.includes(opt.value);
            return (
              <div
                key={opt.value}
                className={`${cls.option} ${isChecked ? cls.optionChecked : ''}`}
                onClick={() => toggle(opt.value)}
              >
                <div className={`${cls.checkbox} ${isChecked ? cls.checkboxChecked : ''}`}>
                  {isChecked && <Check className="w-3 h-3" />}
                </div>
                <div className={cls.optionContent}>
                  <span className={cls.optionLabel}>{opt.label}</span>
                  {opt.description && (
                    <span className={cls.optionDesc}>{opt.description}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
});

MultiSelect.displayName = 'MultiSelect';
