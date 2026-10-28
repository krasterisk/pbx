import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, MoreHorizontal, PhoneOff } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Flex, TableCell, TableRow } from '@/shared/ui';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';
import { callStatusLabel, formatPhone } from '@/features/callcenter/lib/ccFormat';
import { LiveDuration } from '@/features/callcenter/ui/LiveDuration';
import { TransferTargetPicker, type TransferTargetOption } from '@/features/callcenter/ui/TransferTargetPicker';
import styles from './CallCenterSupervisorPage.module.scss';

export interface SupervisorCallRowActions {
  onRedirect: (call: ICall, target: string) => void;
  onSpy: (agentInterface: string) => void;
  onRequestHangup: (call: ICall) => void;
}
interface Props {
  call: ICall;
  index: number;
  agentLabel: string;
  queueLabel: string;
  maxWaitSec: number;
  readyTargetOptions: readonly TransferTargetOption[];
  transferOptions: readonly TransferTargetOption[];
  actions: SupervisorCallRowActions;
}

/** Status changes update their own row, preserving other rows and open controls. */
export const SupervisorCallRow = memo(function SupervisorCallRow({
  call, index, agentLabel, queueLabel, maxWaitSec, readyTargetOptions, transferOptions, actions,
}: Props) {
  const { t } = useTranslation();
  const isWaiting = call.status === 'WAITING' || call.status === 'RINGING';
  const isActive = call.status === 'TALKING' || call.status === 'HOLD';
  const translateStatus = (key: string, fallback?: string) => t(key, fallback ?? key);
  const callStatusBadge = (status: string): string => {
    if (status === 'WAITING' || status === 'RINGING') return styles.badgeWaiting;
    if (status === 'TALKING') return styles.badgeTalking;
    if (status === 'HOLD') return styles.badgeHold;
    return '';
  };

  return (
    <TableRow data-call-id={call.uniqueid} data-status={call.status} data-testid={`supervisor-call-row-${call.uniqueid}`}>
      <TableCell>{index + 1}</TableCell>
      <TableCell>
        <LiveDuration call={call} kind="wait" limitSec={maxWaitSec} />
      </TableCell>
      <TableCell>
        <LiveDuration call={call} kind="talk" />
      </TableCell>
      <TableCell>{formatPhone(call.callerIdNum)}</TableCell>
      <TableCell>{queueLabel}</TableCell>
      <TableCell>
        <span className={`${styles.callStatusBadge} ${callStatusBadge(call.status)}`}>
          {callStatusLabel(call.status, translateStatus)}
        </span>
      </TableCell>
      <TableCell>
        {agentLabel}
      </TableCell>
      <TableCell>
        <Flex align="center" gap="6" wrap="wrap">
          {isWaiting && (
            <TransferTargetPicker
              options={(readyTargetOptions.length > 0 ? readyTargetOptions : transferOptions).filter((o) => o.value !== call.queue && o.value !== call.agent)}
              triggerLabel={t('callcenter.supervisor.pickup', 'Direct')}
              placeholder={t('callcenter.supervisor.transferTarget', 'Target...')}
              onSelect={(target) => actions.onRedirect(call, target)}
              testId={`call-redirect-${call.uniqueid}`}
            />
          )}
          {isActive && call.agent && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => actions.onSpy(call.agent!)}
              data-testid={`call-spy-${call.uniqueid}`}
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              {t('callcenter.supervisor.spy', 'Spy')}
            </Button>
          )}
          {isActive && (
            <>
              <TransferTargetPicker
                options={transferOptions.filter((o) => o.value !== call.queue && o.value !== call.agent)}
                triggerLabel={t('callcenter.supervisor.transfer', 'Transfer')}
                placeholder={t('callcenter.supervisor.transferTarget', 'Target...')}
                onSelect={(target) => actions.onRedirect(call, target)}
                testId={`call-transfer-${call.uniqueid}`}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('callcenter.supervisor.moreActions', 'Actions')}
                    data-testid={`call-more-${call.uniqueid}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => actions.onRequestHangup(call)}
                  >
                    <PhoneOff />
                    {t('callcenter.supervisor.hangupCall', 'Hang up')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </Flex>
      </TableCell>
    </TableRow>
  );
});
