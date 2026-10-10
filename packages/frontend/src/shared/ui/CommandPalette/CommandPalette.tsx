import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/Dialog';
import { Input } from '@/shared/ui/Input';
import { filterPaletteItems, type PaletteItem } from './filterPaletteItems';
import cls from './CommandPalette.module.scss';

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PaletteItem[];
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function CommandPalette({ open, onOpenChange, items, returnFocusRef }: CommandPaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const filtered = useMemo(() => filterPaletteItems(query, items), [query, items]);
  const foundIndex = filtered.findIndex((item) => item.id === activeId);
  const activeIndex = foundIndex < 0 ? 0 : foundIndex;
  const current = filtered[activeIndex];
  const activeOptionId = current ? listId + '-' + activeIndex : undefined;

  useEffect(() => {
    setQuery('');
    setActiveId(null);
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open) optionRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [open, current?.id, activeOptionId]);

  const select = (item: PaletteItem) => { onOpenChange(false); navigate(item.path); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length) {
        const next = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
        setActiveId(filtered[next].id);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (current) select(current);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cls.dialog} data-testid='command-palette' aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current;
          if (target?.isConnected && target.getClientRects().length) { event.preventDefault(); target.focus(); }
        }}>
        <DialogHeader className={cls.header}><DialogTitle>{t('commandPalette.title')}</DialogTitle></DialogHeader>
        <Input ref={inputRef} className={cls.input} value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveId(null); }}
          onKeyDown={onKeyDown} role='combobox' aria-label={t('commandPalette.placeholder')}
          aria-expanded={filtered.length > 0} aria-controls={filtered.length ? listId : undefined}
          aria-activedescendant={activeOptionId} aria-autocomplete='list' autoComplete='off'
          placeholder={t('commandPalette.placeholder')} id='command-palette-input' />
        {filtered.length === 0 ? (
          <div role='status' className={cls.empty} data-testid='command-palette-empty'>{t('commandPalette.empty')}</div>
        ) : (
          <ul id={listId} className={cls.list} role='listbox' aria-label={t('commandPalette.results')}>
            {filtered.map((item, index) => (
              <li key={item.id} role='presentation'>
                <button type='button' role='option' tabIndex={-1} id={listId + '-' + index}
                  ref={index === activeIndex ? optionRef : undefined} aria-selected={index === activeIndex}
                  className={cls.item + (index === activeIndex ? ' ' + cls.itemActive : '')}
                  onClick={() => select(item)} onMouseEnter={() => setActiveId(item.id)}>
                  <span className={cls.label}>{item.label}</span><span className={cls.path}>{item.section ?? item.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
