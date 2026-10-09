import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table2, Code2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';
import {
  DialplanAppsEditor,
  allowedTypesForHost,
} from '@/features/dialplan-apps';
import type { MappedStepErrors } from '@/features/dialplan-apps/model/stepErrors';
import { RawDialplanEditor } from '../RawDialplanEditor/RawDialplanEditor';
import { useGetTenantSettingsQuery } from '@/entities/tenantSettings';
import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';
import type { IRouteAction } from '@krasterisk/shared';

export interface RouteActionsTabProps {
  actions: IRouteAction[];
  setActions: (actions: IRouteAction[]) => void;
  rawDialplan: string;
  setRawDialplan: (dp: string) => void;
  vpbxUserUid: number;
  stepErrors?: MappedStepErrors;
  /** Live route extensions for dial-number preview. */
  previewPatterns?: string[];
}

export const RouteActionsTab = memo(
  ({
    actions,
    setActions,
    rawDialplan,
    setRawDialplan,
    vpbxUserUid,
    stepErrors,
    previewPatterns,
  }: RouteActionsTabProps) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const { editorMode } = useAppSelector((s) => s.routes);
    const { data: tenantSettings } = useGetTenantSettingsQuery();
    const showRawDialplan =
      tenantSettings?.['routes.show_raw_dialplan'] ?? true;
    const [revealErrors, setRevealErrors] = useState(false);
    useEffect(() => {
      if (stepErrors?.byStep.size) setRevealErrors(true);
    }, [stepErrors]);
    const effectiveMode =
      revealErrors || !showRawDialplan ? 'table' : editorMode;

    useEffect(() => {
      if (!showRawDialplan && editorMode === 'raw') {
        dispatch(routesActions.setEditorMode('table'));
      }
    }, [showRawDialplan, editorMode, dispatch]);

    const switchToRaw = useCallback(() => {
      setRevealErrors(false);
      dispatch(routesActions.setEditorMode('raw'));
      if (rawDialplan.trim()) {
        setRawDialplan(
          ensureCdrVpbxUserUidInDialplan(rawDialplan, vpbxUserUid),
        );
      }
    }, [dispatch, rawDialplan, setRawDialplan, vpbxUserUid]);

    return (
      <VStack gap="12" align="stretch" max>
        {showRawDialplan && (
          <HStack gap="8">
            <Button
              type="button"
              size="sm"
              variant={effectiveMode === 'table' ? 'default' : 'outline'}
              onClick={() => dispatch(routesActions.setEditorMode('table'))}
            >
              <Table2 className="w-4 h-4 mr-2" />
              {t('routes.modeTable', 'Таблица')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={effectiveMode === 'raw' ? 'default' : 'outline'}
              onClick={switchToRaw}
            >
              <Code2 className="w-4 h-4 mr-2" />
              {t('routes.modeRaw', 'Dialplan')}
            </Button>
          </HStack>
        )}

        {effectiveMode === 'table' && (
          <>
            <DialplanAppsEditor
              host="route"
              showTemplateActions
              labels={{ namespace: 'routes.chain' }}
              allowedTypes={allowedTypesForHost('route')}
              actions={actions}
              onChange={setActions}
              stepErrors={stepErrors}
              previewPatterns={previewPatterns}
            />
          </>
        )}
        {showRawDialplan && effectiveMode === 'raw' && (
          <RawDialplanEditor
            value={rawDialplan}
            onChange={setRawDialplan}
            vpbxUserUid={vpbxUserUid}
          />
        )}
      </VStack>
    );
  },
);

RouteActionsTab.displayName = 'RouteActionsTab';
