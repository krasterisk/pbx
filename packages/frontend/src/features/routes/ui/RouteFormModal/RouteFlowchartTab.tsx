import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type IRouteAction } from '@krasterisk/shared';
import { FlowchartCanvas } from '@/features/dialplan-apps/ui/FlowchartCanvas';
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
      <FlowchartCanvas
        host="route"
        actions={actions}
        title={routeName}
        patterns={extensions}
      />
    </div>
  );
});

RouteFlowchartTab.displayName = 'RouteFlowchartTab';
