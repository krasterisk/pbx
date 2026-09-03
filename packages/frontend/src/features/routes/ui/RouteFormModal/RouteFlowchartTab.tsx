import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type IRouteAction } from '@krasterisk/shared';
import { DryRunForm } from '@/features/dialplan-apps/ui/DryRunForm';
import { FlowchartCanvas } from '@/features/dialplan-apps/ui/FlowchartCanvas';
import type { FlowchartHighlight } from '@/features/dialplan-apps/ui/FlowchartCanvas';
import type { IDryRunResult } from '@/shared/api/endpoints/dryRunApi';
import cls from './RouteFlowchartTab.module.scss';

export interface RouteFlowchartTabProps {
  actions: IRouteAction[];
  routeName: string;
  extensions: string[];
}

export const RouteFlowchartTab = memo(function RouteFlowchartTab({
  actions,
  routeName,
  extensions,
}: RouteFlowchartTabProps) {
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
    <div className={cls.tab} data-testid="route-flowchart-tab">
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
        host="route"
        actions={actions}
        entityName={routeName}
        onResultChange={handleResult}
      />
      <FlowchartCanvas
        host="route"
        actions={actions}
        title={routeName}
        patterns={extensions}
        highlight={highlight}
      />
    </div>
  );
});

RouteFlowchartTab.displayName = 'RouteFlowchartTab';
