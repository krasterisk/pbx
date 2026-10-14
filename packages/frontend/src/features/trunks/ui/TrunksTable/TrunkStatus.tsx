import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleHelp, CirclePause, CircleX, PlugZap, Unplug } from 'lucide-react';
import { Flex, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '@/shared/ui';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import { trunkRegistrationState } from './trunkRegistration';
import cls from './TrunksTable.module.scss';

type Props = Pick<ITrunkListItem, 'trunkType' | 'registrationStatus' | 'reachabilityStatus'>;

function StatusIcon({ label, state, kind, tone, children }: {
  label: string;
  state: string;
  kind: 'registration' | 'reachability';
  tone: 'success' | 'danger' | 'warning' | 'neutral';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRoot open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          type="button"
          className={cls.statusIcon}
          aria-label={label}
          data-status-tone={tone}
          {...(kind === 'registration' ? { 'data-registration': state } : { 'data-reachability': state })}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.pointerType === 'touch') setOpen(true);
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent onPointerDownOutside={() => setOpen(false)}>{label}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export function TrunkStatus({ trunkType, registrationStatus, reachabilityStatus = 'Unknown' }: Props) {
  const { t } = useTranslation();
  const registration = trunkRegistrationState(registrationStatus);
  const registrationKey = registration === 'Unknown' ? 'trunks.registrationUnknown' : `trunks.status${registration}`;
  const registrationTone = registration === 'Registered' ? 'success' : registration === 'Rejected' ? 'danger' : registration === 'Unknown' ? 'neutral' : 'warning';
  const reachabilityTone = reachabilityStatus === 'Reachable' ? 'success' : reachabilityStatus === 'Unreachable' ? 'danger' : reachabilityStatus === 'Unqualified' ? 'warning' : 'neutral';
  return (
    <Flex gap="4" align="center" className={cls.statusIcons}>
      {trunkType === 'auth' && (
        <StatusIcon
          kind="registration"
          state={registration}
          tone={registrationTone}
          label={`${t('trunks.registrationLabel')}: ${t(registrationKey)}`}
        >
          {registration === 'Registered' ? <CircleCheck aria-hidden="true" size={17} /> : registration === 'Rejected' ? <CircleX aria-hidden="true" size={17} /> : registration === 'Unknown' ? <CircleHelp aria-hidden="true" size={17} /> : <CirclePause aria-hidden="true" size={17} />}
        </StatusIcon>
      )}
      <StatusIcon
        kind="reachability"
        state={reachabilityStatus}
        tone={reachabilityTone}
        label={`${t('trunks.reachabilityLabel')}: ${t(`trunks.reachability${reachabilityStatus}`)}`}
      >
        {reachabilityStatus === 'Reachable' ? <PlugZap aria-hidden="true" size={17} /> : reachabilityStatus === 'Unreachable' ? <Unplug aria-hidden="true" size={17} /> : <CircleHelp aria-hidden="true" size={17} />}
      </StatusIcon>
    </Flex>
  );
}
