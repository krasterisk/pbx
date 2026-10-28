import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button, Flex, Tooltip } from '@/shared/ui';
import { CommandPalette, type PaletteItem } from '@/shared/ui/CommandPalette';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import cls from './TopbarSearch.module.scss';

export function TopbarSearch({ items }: { items: PaletteItem[] }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isMobile = useIsMobile(768);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const suppressFocus = useRef(false);
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  const openSearch = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    if (isMobile) return; // The modal restores focus after its focus trap unmounts.
    const target = returnFocusRef.current ?? triggerRef.current;
    if (target?.isConnected) {
      if (target === document.activeElement) return;
      suppressFocus.current = target === triggerRef.current;
      target.focus();
    }
  }, [isMobile]);

  useEffect(() => { setOpen(false); }, [pathname, isMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (open) closeSearch(); else openSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openSearch, closeSearch]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, isMobile]);

  return <Flex ref={rootRef} className={`${cls.root} ${open && !isMobile ? cls.expanded : ''}`}
    data-testid="shell-search" data-expanded={open && !isMobile ? 'true' : 'false'}
    onBlur={event => {
      if (!isMobile && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
    <Tooltip content={`${t('commandPalette.placeholder')} (${mod}+K)`}>
      <Button type="button" variant="ghost" size="icon" id="shell-cmdk-trigger" ref={triggerRef}
        className={cls.trigger} aria-label={t('commandPalette.placeholder')} aria-expanded={open}
        aria-haspopup={isMobile ? 'dialog' : 'listbox'}
        aria-controls={open && !isMobile ? 'shell-search-content' : undefined}
        onFocus={() => {
          if (suppressFocus.current) { suppressFocus.current = false; return; }
          if (!isMobile) openSearch();
        }}
        onMouseDown={event => { if (open && !isMobile) event.preventDefault(); }}
        onClick={() => { if (!open) openSearch(); }}>
        <Search size={18} aria-hidden />
      </Button>
    </Tooltip>
    {open && <>
      {isMobile ? <CommandPalette open items={items} onOpenChange={next => next ? openSearch() : closeSearch()}
        returnFocusRef={returnFocusRef} presentation="fullscreen" /> :
        <Flex className={cls.field} id="shell-search-content">
          <CommandPalette open items={items} onOpenChange={next => next ? openSearch() : closeSearch()} presentation="inline" />
        </Flex>}
    </>}
  </Flex>;
}
