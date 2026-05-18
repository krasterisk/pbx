import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Table2, Code2 } from 'lucide-react';
import { Button, Input, Label, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';
import { DialplanAppsEditor } from '@/features/dialplan-apps';
import { RawDialplanEditor } from '../RawDialplanEditor/RawDialplanEditor';
import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';
import type { IRouteAction } from '@krasterisk/shared';
import styles from './RouteFormModal.module.scss';

export interface RouteActionsTabProps {
  actions: IRouteAction[];
  setActions: (actions: IRouteAction[]) => void;
  rawDialplan: string;
  setRawDialplan: (dp: string) => void;
  preCommand: string;
  setPreCommand: (v: string) => void;
  vpbxUserUid: number;
}

export const RouteActionsTab = memo(({ actions, setActions, rawDialplan, setRawDialplan, preCommand, setPreCommand, vpbxUserUid }: RouteActionsTabProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { editorMode } = useAppSelector((s) => s.routes);

  const switchToRaw = useCallback(() => {
    dispatch(routesActions.setEditorMode('raw'));
    if (rawDialplan.trim()) {
      setRawDialplan(ensureCdrVpbxUserUidInDialplan(rawDialplan, vpbxUserUid));
    }
  }, [dispatch, rawDialplan, setRawDialplan, vpbxUserUid]);

  return (
    <VStack gap="12">
      <VStack gap="4">
        <HStack gap="4" align="center">
          <Label htmlFor="route-precmd">{t('routes.preCommand', 'Предварительная команда')}</Label>
          <InfoTooltip text={t('routes.preCommandTooltip', 'Asterisk-команда, выполняемая до начала обработки действий маршрута. Например, Set() для модификации CallerID или установки переменных канала.')} />
        </HStack>
        <Input
          id="route-precmd"
          value={preCommand}
          onChange={(e) => setPreCommand(e.target.value)}
          placeholder="Set(CALLERID(num)=8${CALLERID(num)})"
          className={styles.mono}
        />
      </VStack>

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
          onClick={switchToRaw}
        >
          <Code2 className="w-4 h-4 mr-2" />
          {t('routes.modeRaw', 'Dialplan')}
        </Button>
      </HStack>

      {editorMode === 'table' && (
        <DialplanAppsEditor actions={actions} onChange={setActions} />
      )}
      {editorMode === 'raw' && (
        <RawDialplanEditor
          value={rawDialplan}
          onChange={setRawDialplan}
          vpbxUserUid={vpbxUserUid}
        />
      )}
    </VStack>
  );
});

RouteActionsTab.displayName = 'RouteActionsTab';

