import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, History, Phone, Settings2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui';
import { PhoneActionsContext } from '../model/PhoneActionsContext';
import { dialableNumber, formatPhoneNumber, phoneHistoryHref } from '../model/phoneNumber';

export function PhoneNumber({ number, name, fallback = '—' }: {
  number: string | null | undefined;
  name?: string | null;
  fallback?: string;
}) {
  const { t } = useTranslation();
  const phone = useContext(PhoneActionsContext);
  const target = dialableNumber(number);
  if (!target) return <span>{name || fallback}</span>;
  const display = formatPhoneNumber(target);
  const repeatedNumber = name != null && /^[+\d\s().*-]+$/.test(name.trim()) && dialableNumber(name) === target;
  const displayName = name?.trim() && !repeatedNumber ? name : undefined;
  return (
    <span data-table-no-activate onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
    }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="link" size="none" className="max-w-full text-left whitespace-normal" style={{font:'inherit'}} aria-label={t('phoneNumber.actionsFor', { number: displayName ? `${displayName} (${display})` : display })}>
            {displayName || display}{displayName && <span className="text-muted-foreground font-normal"> · {display}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{displayName ? `${displayName} · ${display}` : display}</DropdownMenuLabel>
          <DropdownMenuItem disabled={!phone?.canCall && !phone?.configure} onSelect={() => {
            if (!phone?.canCall) { phone?.configure?.(); return; }
            void Promise.resolve().then(() => phone.call(target)).catch(() => toast.error(t('phoneNumber.callFailed')));
          }}>
            {phone?.canCall ? <Phone size={16}/> : <Settings2 size={16}/>}
            {t(phone?.canCall ? 'phoneNumber.call' : phone?.configure ? 'phoneNumber.connect' : 'phoneNumber.disconnected')}
          </DropdownMenuItem>
          <DropdownMenuItem asChild><Link to={phoneHistoryHref(target)}><History size={16}/>{t('phoneNumber.history')}</Link></DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onSelect={() => {
            void Promise.resolve().then(() => navigator.clipboard.writeText(target))
              .then(() => toast.success(t('phoneNumber.copied'))).catch(() => toast.error(t('phoneNumber.copyFailed')));
          }}><Copy size={16}/>{t('phoneNumber.copy')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
