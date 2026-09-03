import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type IIvrMenuItem } from '@/entities/ivr';
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
  const { t } = useTranslation();

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
      <FlowchartCanvas
        host="ivr"
        title={name}
        menuItems={menuItems}
        ivrTimeout={timeout}
        ivrTimeoutResponse={timeoutResponse}
        ivrTimeoutDigit={timeoutDigit}
        ivrMaxCount={maxCount}
      />
    </div>
  );
});

IvrFlowchartTab.displayName = 'IvrFlowchartTab';
