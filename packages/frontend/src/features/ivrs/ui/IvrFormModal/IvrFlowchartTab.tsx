import { memo } from 'react';
import { type IIvrMenuItem } from '@/entities/ivr';
import { VStack } from '@/shared/ui';
import { FlowchartCanvas } from '@/features/dialplan-apps/ui/FlowchartCanvas';
import cls from './IvrFlowchartTab.module.scss';

export interface IvrFlowchartTabProps {
  name: string;
  menuItems: IIvrMenuItem[];
  timeout?: string | null;
  timeoutResponse?: string | null;
  timeoutDigit?: string | null;
  maxCount?: number;
}

export const IvrFlowchartTab = memo(function IvrFlowchartTab({
  name,
  menuItems,
  timeout,
  timeoutResponse,
  timeoutDigit,
  maxCount,
}: IvrFlowchartTabProps) {
  return (
    <VStack align="stretch" max className={cls.tab} data-testid="ivr-flowchart-tab">
      <FlowchartCanvas
        host="ivr"
        title={name}
        menuItems={menuItems}
        ivrTimeout={timeout}
        ivrTimeoutResponse={timeoutResponse}
        ivrTimeoutDigit={timeoutDigit}
        ivrMaxCount={maxCount}
      />
    </VStack>
  );
});

IvrFlowchartTab.displayName = 'IvrFlowchartTab';
