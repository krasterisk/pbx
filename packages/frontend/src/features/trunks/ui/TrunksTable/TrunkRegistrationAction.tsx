import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { TableRowAction, Tooltip } from '@/shared/ui';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import { trunkRegistrationState } from './trunkRegistration';
import cls from './TrunksTable.module.scss';

export function TrunkRegistrationAction({ trunk, pending, onRegister }: {
  trunk: ITrunkListItem;
  pending: boolean;
  onRegister: (trunk: ITrunkListItem) => void;
}) {
  const { t } = useTranslation();
  if (trunk.trunkType !== 'auth' || trunkRegistrationState(trunk.registrationStatus) === 'Registered') return null;
  const label = t('trunks.refreshRegistration');
  const tooltip = pending ? t('trunks.registrationInProgress') : label;
  return (
    <Tooltip content={tooltip}>
      <span data-table-actions className={cls.actionTooltipTarget} tabIndex={pending ? 0 : undefined} aria-label={pending ? tooltip : undefined}>
        <TableRowAction
          aria-label={label}
          aria-busy={pending}
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            onRegister(trunk);
          }}
        >
          {pending ? <Loader2 aria-hidden="true" className={cls.spinner} /> : <RefreshCw aria-hidden="true" />}
        </TableRowAction>
      </span>
    </Tooltip>
  );
}
