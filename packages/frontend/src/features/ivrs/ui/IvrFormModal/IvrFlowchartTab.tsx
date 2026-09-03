import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type IIvrMenuItem } from '@/entities/ivr';
import { DryRunForm } from '@/features/dialplan-apps/ui/DryRunForm';
import { FlowchartCanvas } from '@/features/dialplan-apps/ui/FlowchartCanvas';
import type { FlowchartHighlight } from '@/features/dialplan-apps/ui/FlowchartCanvas';
import type { IDryRunResult } from '@/shared/api/endpoints/dryRunApi';
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
  const { t } = useTranslation();
  const [highlight, setHighlight] = useState<FlowchartHighlight | null>(null);

  const handleResult = (result: IDryRunResult | null) => {
    if (!result) {
      setHighlight(null);
      return;
    }
    setHighlight({
      segments: result.segments,
      outcome: result.outcome,
    });
  };

  return (
    <div className={cls.tab} data-testid="ivr-flowchart-tab">
      <p className={cls.banner}>
        {t(
          'routes.flowchart.viewOnly',
          'Схема только для просмотра. Действия меняются на вкладке "Действия"',
        )}
      </p>
      <p className={cls.banner}>
        {t(
          'routes.flowchart.draftNote',
          'Схема строится по текущему черновику, включая несохранённые изменения',
        )}
      </p>
      <DryRunForm
        host="ivr"
        menuItems={menuItems}
        maxCount={maxCount}
        entityName={name}
        onResultChange={handleResult}
      />
      <FlowchartCanvas
        host="ivr"
        title={name}
        menuItems={menuItems}
        ivrTimeout={timeout}
        ivrTimeoutResponse={timeoutResponse}
        ivrTimeoutDigit={timeoutDigit}
        ivrMaxCount={maxCount}
        highlight={highlight}
      />
    </div>
  );
});

IvrFlowchartTab.displayName = 'IvrFlowchartTab';
