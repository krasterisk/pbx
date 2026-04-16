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
  /** Currently selected values (comma-separated string or array) */
  value: string | string[];
  /** Called with comma-separated string of selected values */
  onChange: (value: string) => void;
  /** Available options */
  options: MultiSelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Optional className */
  className?: string;
}

/**
 * Multi-select with tags and dropdown checklist.
 * Selected items appear as removable tags at the top.
 * Dropdown shows checkboxes for each option.
 * Rendered via createPortal to evade modal boundary overflow issues.
 */
export const MultiSelect = memo(({ value, onChange, options, placeholder, className }: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selected: string[] = Array.isArray(value)
    ? value
    : value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const updateDropdownPosition = useCallback(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: PORTAL_Z_INDEX,
        pointerEvents: 'auto', // Fix for Radix Dialog setting pointer-events: none on body
      });
    }
  }, [isOpen]);

  useEffect(() => {
    updateDropdownPosition();
    if (isOpen) {
      // Capture true ensures we catch scroll events from parent containers
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    // Prevent clicks inside the dropdown from bubbling up to document
    // This stops Radix Dialog from intercepting pointerdown and blocking scroll/clicks
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
    onChange(next.join(','));
  }, [selected, onChange]);

  const remove = useCallback((val: string) => {
    onChange(selected.filter(s => s !== val).join(','));
  }, [selected, onChange]);

  const clearAll = useCallback(() => onChange(''), [onChange]);

  const getLabel = (val: string) => {
    const opt = options.find(o => o.value === val);
    return opt ? opt.label : val;
  };

  return (
    <div ref={containerRef} className={`${cls.container} ${className || ''}`}>
      {/* Tags area + trigger */}
      <div
        ref={triggerRef}
        className={`${cls.trigger} ${isOpen ? cls.triggerOpen : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div className={cls.tagsArea}>
          {selected.length === 0 && (
            <span className={cls.placeholder}>{placeholder || 'Select...'}</span>
          )}
          {selected.map(val => (
            <span key={val} className={cls.tag}>
              {getLabel(val)}
              <button
                type="button"
                className={cls.tagRemove}
                onClick={e => { e.stopPropagation(); remove(val); }}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
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
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown in Portal */}
      {isOpen && createPortal(
        <div 
          ref={dropdownRef} 
          className={cls.dropdown} 
          style={dropdownStyle}
          onWheel={(e) => {
            // Bypass global Radix react-remove-scroll locks by forcing manual scroll
            if (dropdownRef.current) {
              dropdownRef.current.scrollTop += e.deltaY;
            }
          }}
        >
          {options.map(opt => {
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
