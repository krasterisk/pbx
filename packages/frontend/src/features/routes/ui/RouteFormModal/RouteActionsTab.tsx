import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table2, Code2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';
import { DialplanAppsEditor } from '@/features/dialplan-apps';
import { RawDialplanEditor } from '../RawDialplanEditor/RawDialplanEditor';
import type { IRouteAction } from '@krasterisk/shared';

export interface RouteActionsTabProps {
  actions: IRouteAction[];
  setActions: (actions: IRouteAction[]) => void;
  rawDialplan: string;
  setRawDialplan: (dp: string) => void;
}

export const RouteActionsTab = memo(({ actions, setActions, rawDialplan, setRawDialplan }: RouteActionsTabProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { editorMode } = useAppSelector((s) => s.routes);

  return (
    <VStack gap="12">
      <HStack gap="8">
        <Button
          type="button"
          size="sm"
          variant={editorMode === 'table' ? 'default' : 'outline'}
          onClick={() => dispatch(routesActions.setEditorMode('table'))}
        >
          <Table2 className="w-4 h-4 mr-2" />
          {t('routes.modeTable', 'Таблица')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editorMode === 'raw' ? 'default' : 'outline'}
          onClick={() => dispatch(routesActions.setEditorMode('raw'))}
        >
          <Code2 className="w-4 h-4 mr-2" />
          {t('routes.modeRaw', 'Dialplan')}
        </Button>
      </HStack>

      {editorMode === 'table' && (
        <DialplanAppsEditor actions={actions} onChange={setActions} />
      )}
      {editorMode === 'raw' && (
        <RawDialplanEditor value={rawDialplan} onChange={setRawDialplan} />
      )}
    </VStack>
  );
});

RouteActionsTab.displayName = 'RouteActionsTab';
