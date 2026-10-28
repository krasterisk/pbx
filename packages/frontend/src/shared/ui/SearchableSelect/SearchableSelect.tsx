import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover';

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  label: string;
  searchLabel: string;
  emptyLabel: string;
  disabled?: boolean;
}

/** Single selection with local search and keyboard navigation inside the popup. */
export function SearchableSelect({ id, value, onChange, options, label, searchLabel, emptyLabel, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return options.filter(option => option.label.toLocaleLowerCase().includes(needle) || option.value.toLocaleLowerCase().includes(needle));
  }, [options, query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);
  const select = (next: string) => {
    if (options.find(option => option.value === next)?.disabled) return;
    onChange(next); setOpen(false);
  };
  return <Popover open={open && !disabled} onOpenChange={next => { setOpen(next); setQuery(''); setActive(Math.max(0, options.findIndex(option => option.value === value))); }}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" className="h-10 w-full min-w-0 justify-between font-normal" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open && !disabled}>
        <span className="truncate">{options.find(option => option.value === value)?.label || value || label}</span>
        <ChevronsUpDown size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-56 max-w-[calc(100vw-2rem)] p-2">
      <Input role="combobox" aria-label={searchLabel} aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined} placeholder={searchLabel} value={query}
        onChange={event => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive(index => {
              for (let next = index + step; next >= 0 && next < filtered.length; next += step) {
                if (!filtered[next].disabled) return next;
              }
              return index;
            });
          } else if (event.key === 'Enter') {
            event.preventDefault();
            if (filtered[active]) select(filtered[active].value);
          }
        }} />
      <div ref={listRef} id={listId} role="listbox" aria-label={label} className="mt-2 max-h-60 overflow-y-auto">
        {filtered.map((option, index) => <button key={option.value} id={`${listId}-${index}`} type="button" role="option" aria-selected={option.value === value} tabIndex={-1} data-option-index={index}
          disabled={option.disabled} aria-disabled={option.disabled || undefined}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${index === active ? 'bg-accent text-accent-foreground' : ''}`}
          onMouseMove={() => setActive(index)} onClick={() => select(option.value)}>
          <Check size={14} className={option.value === value ? 'shrink-0' : 'invisible shrink-0'} aria-hidden="true" />{option.label}
        </button>)}
        {!filtered.length && <p role="status" className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
