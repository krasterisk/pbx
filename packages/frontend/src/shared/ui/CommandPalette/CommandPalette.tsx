import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';
import { Input } from '@/shared/ui';
import { filterPaletteItems, type PaletteItem } from './filterPaletteItems';
import cls from './CommandPalette.module.scss';

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PaletteItem[];
};

/**
 * ⌘K / Ctrl+K palette — Dialog + Input + keyboard-navigable list (D-06).
 * No cmdk dependency (UI-SPEC / T-08-SC).
 */
export function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(
    () => filterPaletteItems(query, items),
    [query, items],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectItem = (item: PaletteItem) => {
    onOpenChange(false);
    navigate(item.path);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setActiveIndex((i) => (i + 1) % filtered.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) selectItem(item);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cls.dialog}
        data-testid="command-palette"
        aria-describedby={undefined}
        onKeyDown={onKeyDown}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('commandPalette.placeholder')}</DialogTitle>
          <DialogDescription>{t('commandPalette.placeholder')}</DialogDescription>
        </DialogHeader>

        <Input
          ref={inputRef}
          className={cls.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('commandPalette.placeholder')}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          id="command-palette-input"
        />

        {filtered.length === 0 ? (
          <div className={cls.empty} data-testid="command-palette-empty">
            {t('commandPalette.empty')}
          </div>
        ) : (
          <ul id={listId} className={cls.list} role="listbox">
            {filtered.map((item, index) => (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`${cls.item}${index === activeIndex ? ` ${cls.itemActive}` : ''}`}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span>{item.label}</span>
                  <span className={cls.path}>{item.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
