import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Checkbox, Label, InfoTooltip, Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { ExtensionChips } from '../ExtensionChips/ExtensionChips';
import type { IContext } from '@/shared/api/endpoints/contextApi';
import { useHubModules } from '@/features/modules/hooks/useHubModules';
import { useGetSaProjectsQuery } from '@/features/speechAnalytics/api/speechAnalyticsApi';
import styles from './RouteFormModal.module.scss';

export interface AnalyticsProjectOption {
  id: string;
  name: string;
}

export interface RouteGeneralTabProps {
  name: string;
  setName: (v: string) => void;
  extensions: string[];
  setExtensions: (v: string[]) => void;
  active: boolean;
  setActive: (v: boolean) => void;
  routeType: number;
  setRouteType: (v: number) => void;
  record: boolean;
  setRecord: (v: boolean) => void;
  recordAll: boolean;
  setRecordAll: (v: boolean) => void;
  recordStereo: boolean;
  setRecordStereo: (v: boolean) => void;
  /** @deprecated D-01 — ignored; project Select replaces inherit/off/on */
  analyticsMode: 'inherit' | 'off' | 'on';
  /** @deprecated D-01 — parent may still pass; not used for auto analysis */
  setAnalyticsMode: (v: 'inherit' | 'off' | 'on') => void;
  analyticsProjectId: string;
  setAnalyticsProjectId: (v: string) => void;
  /** Override hub entitlement (tests). When omitted, resolved from hub catalog. */
  speechAnalyticsModuleActive?: boolean;
  /** Override project list (tests). When omitted, loaded via tenant-scoped API. */
  analyticsProjects?: AnalyticsProjectOption[];
  analyticsProjectsLoading?: boolean;
  analyticsProjectsError?: boolean;
  onRetryAnalyticsProjects?: () => void;
  /** Context selector (create/copy mode) */
  contextUid: number | null;
  setContextUid: (v: number) => void;
  isCreateMode: boolean;
  contexts: IContext[];
}

/** Encode record/recordAll pair into a single select value */
function encodeRecordMode(record: boolean, recordAll: boolean): string {
  if (!record) return 'off';
  return recordAll ? 'all' : 'calls';
}

/** Decode: protect against API sending record_all:true without record:true */
export function decodeRecordMode(opts: { record?: boolean; record_all?: boolean }): 'off' | 'calls' | 'all' {
  if (!opts.record) return 'off';
  return opts.record_all ? 'all' : 'calls';
}

export const RouteGeneralTab = memo((props: RouteGeneralTabProps) => {
  const {
    name, setName, extensions, setExtensions, active, setActive,
    routeType, setRouteType, record, setRecord, recordAll, setRecordAll,
    recordStereo, setRecordStereo,
    analyticsProjectId, setAnalyticsProjectId,
    speechAnalyticsModuleActive,
    analyticsProjects: analyticsProjectsProp,
    analyticsProjectsLoading: analyticsProjectsLoadingProp,
    analyticsProjectsError: analyticsProjectsErrorProp,
    onRetryAnalyticsProjects,
    contextUid, setContextUid, contexts,
  } = props;

  const { t } = useTranslation();
  const hub = useHubModules();

  const moduleActive = speechAnalyticsModuleActive
    ?? hub.active.some((m) => m.code === 'speech_analytics' && m.licenseStatus === 'active');

  const showProjectSelect = moduleActive && record;

  const projectsQuery = useGetSaProjectsQuery(undefined, {
    skip: !showProjectSelect || analyticsProjectsProp !== undefined,
  });

  const projects = useMemo((): AnalyticsProjectOption[] => {
    if (analyticsProjectsProp) return analyticsProjectsProp;
    return (projectsQuery.data ?? []).map((p) => ({ id: p.id, name: p.name }));
  }, [analyticsProjectsProp, projectsQuery.data]);

  const projectsLoading = analyticsProjectsLoadingProp ?? (!analyticsProjectsProp && projectsQuery.isLoading);
  const projectsError = analyticsProjectsErrorProp ?? (!analyticsProjectsProp && projectsQuery.isError);

  const handleRecordModeChange = (mode: string) => {
    switch (mode) {
      case 'off':
        setRecord(false);
        setRecordAll(false);
        setRecordStereo(false);
        break;
      case 'calls':
        setRecord(true);
        setRecordAll(false);
        break;
      case 'all':
        setRecord(true);
        setRecordAll(true);
        break;
    }
  };

  const selectValue = projects.some((p) => p.id === analyticsProjectId)
    ? analyticsProjectId
    : '';

  return (
    <VStack gap="16">
      {/* Active toggle */}
      <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
        <Label className="cursor-pointer" htmlFor="route-active">
          {t('common.active', 'Активен')}
        </Label>
        <Checkbox
          id="route-active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </HStack>

      {/* Name + Context in one responsive row */}
      <HStack gap="12" className={styles.nameContextRow}>
        <VStack gap="4" className={styles.nameContextField}>
          <Label htmlFor="route-name">{t('routes.name', 'Наименование маршрута')}</Label>
          <Input
            id="route-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('routes.namePlaceholder', 'Входящий городской')}
          />
        </VStack>

        <VStack gap="4" className={styles.nameContextField}>
            <Label htmlFor="route-context">{t('routes.context', 'Контекст')} *</Label>
            <Select
              id="route-context"
              value={contextUid ?? ''}
              onChange={(e) => setContextUid(Number(e.target.value))}
            >
              <option value="" disabled>{t('routes.selectContext', 'Выберите контекст')}</option>
              {contexts.map((ctx) => (
                <option key={ctx.uid} value={ctx.uid}>
                  {ctx.name} {ctx.comment ? `(${ctx.comment})` : ''}
                </option>
              ))}
            </Select>
          </VStack>
      </HStack>

      <ExtensionChips value={extensions} onChange={setExtensions} />

      <VStack gap="4">
        <Label htmlFor="route-type">{t('routes.routeType', 'Тип маршрута (права доступа)')}</Label>
        <Select
          id="route-type"
          value={routeType}
          onChange={(e) => setRouteType(Number(e.target.value))}
        >
          <option value={0}>{t('routes.routeTypeOption.0', 'Не использовать')}</option>
          <option value={1}>{t('routes.routeTypeOption.1', 'Локальные вызовы')}</option>
          <option value={2}>{t('routes.routeTypeOption.2', 'Местные вызовы')}</option>
          <option value={3}>{t('routes.routeTypeOption.3', 'Мобильные вызовы')}</option>
          <option value={4}>{t('routes.routeTypeOption.4', 'Междугородние вызовы')}</option>
          <option value={5}>{t('routes.routeTypeOption.5', 'Международные вызовы')}</option>
        </Select>
      </VStack>

      {/* Recording - select for when; stereo checkbox appears when recording is on */}
      <VStack gap="4">
        <HStack gap="4" align="center">
          <Label htmlFor="route-record-mode">{t('routes.recordMode', 'Запись разговоров')}</Label>
          <InfoTooltip text={t('routes.recordModeTooltip', 'При соединении - запись начинается после ответа. Все вызовы - запись ведётся с момента входящего вызова, включая ожидание и IVR.')} />
        </HStack>
        <Select
          id="route-record-mode"
          value={encodeRecordMode(record, recordAll)}
          onChange={(e) => handleRecordModeChange(e.target.value)}
        >
          <option value="off">{t('routes.recordOff', 'Не записывать')}</option>
          <option value="calls">{t('routes.recordCalls', 'При соединении')}</option>
          <option value="all">{t('routes.recordAllCalls', 'Все вызовы (включая без соединения)')}</option>
        </Select>
        {record && (
          <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full mt-2">
            <HStack gap="4" align="center">
              <Label className="cursor-pointer" htmlFor="route-record-stereo">
                {t('routes.recordStereo', 'Стерео (раздельные каналы)')}
              </Label>
              <InfoTooltip text={t('routes.recordStereoTooltip', 'Входящий и исходящий аудиопоток записываются в отдельные дорожки стереофайла.')} />
            </HStack>
            <Checkbox
              id="route-record-stereo"
              checked={recordStereo}
              onChange={(e) => setRecordStereo(e.target.checked)}
            />
          </HStack>
        )}
      </VStack>

      {showProjectSelect && (
        <VStack gap="4" className={styles.analyticsProjectField}>
          <HStack gap="4" align="center">
            <Label htmlFor="route-analytics-project">
              {t('speechAnalytics.routeProjectLabel', 'Analytics project')}
            </Label>
            <InfoTooltip
              text={t(
                'speechAnalytics.routeProjectHint',
                '**None** - no auto-analysis\n**Project** - after the call the closed recording is analyzed with this project\nRecording must be enabled on the route',
              )}
            />
          </HStack>
          {projectsError ? (
            <VStack gap="8">
              <Text variant="muted">
                {t('speechAnalytics.errorLoadProjects', 'Could not load projects. Try again.')}
              </Text>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onRetryAnalyticsProjects) onRetryAnalyticsProjects();
                  else void projectsQuery.refetch();
                }}
              >
                {t('speechAnalytics.retry', 'Retry')}
              </Button>
            </VStack>
          ) : (
            <Select
              id="route-analytics-project"
              className={styles.analyticsProjectSelect}
              value={selectValue}
              disabled={projectsLoading}
              aria-busy={projectsLoading || undefined}
              onChange={(e) => setAnalyticsProjectId(e.target.value)}
            >
              <option value="">
                {projectsLoading
                  ? t('speechAnalytics.loading', 'Loading…')
                  : t('speechAnalytics.routeProjectPlaceholder', 'No project')}
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id} title={project.name}>
                  {project.name}
                </option>
              ))}
            </Select>
          )}
        </VStack>
      )}
    </VStack>
  );
});

RouteGeneralTab.displayName = 'RouteGeneralTab';
