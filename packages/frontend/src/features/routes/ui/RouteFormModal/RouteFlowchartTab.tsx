import { memo } from 'react';
import type { IRouteAction } from '@krasterisk/shared';
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
  return (
    <div className={cls.tab} data-testid="route-flowchart-tab">
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
