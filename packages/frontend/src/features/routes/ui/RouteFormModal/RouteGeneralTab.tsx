import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useMemo, useEffect, useRef, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, ListFilter, AudioLines, ChevronDown } from 'lucide-react';
import { Input, Select, Switch, Label, InfoTooltip, Text, Button } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
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
  fieldErrors?: Record<string, string>;
  name: string;
  setName: (v: string) => void;
  extensions: string[];
  setExtensions: (v: string[]) => void;
  onRuleDraftChange?: (pending: boolean) => void;
  active: boolean;
  setActive: (v: boolean) => void;
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
export function decodeRecordMode(opts: {
  record?: boolean;
  record_all?: boolean;
}): 'off' | 'calls' | 'all' {
  if (!opts.record) return 'off';
  return opts.record_all ? 'all' : 'calls';
}

export const RouteGeneralTab = memo((props: RouteGeneralTabProps) => {
  const {
    name,
    setName,
    extensions,
    setExtensions,
    active,
    setActive,
    record,
    setRecord,
    recordAll,
    setRecordAll,
    recordStereo,
    setRecordStereo,
    analyticsProjectId,
    setAnalyticsProjectId,
    speechAnalyticsModuleActive,
    analyticsProjects: analyticsProjectsProp,
    analyticsProjectsLoading: analyticsProjectsLoadingProp,
    analyticsProjectsError: analyticsProjectsErrorProp,
    onRetryAnalyticsProjects,
    contextUid,
    setContextUid,
    contexts,
    fieldErrors,
  } = props;

  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const sectionId = useId();
  const [processingExpanded, setProcessingExpanded] = useState(() => !props.isCreateMode && (record || !!analyticsProjectId));
  useEffect(() => { if (!props.isCreateMode && (record || analyticsProjectId)) setProcessingExpanded(true); }, [record, analyticsProjectId, props.isCreateMode]);
  useEffect(() => {
    const key = Object.keys(fieldErrors ?? {})[0];
    const selectors: Record<string, string> = {
      name: '#route-name',
      context_uid: '#route-context',
      extensions: '[data-field-key="extensions"] input',
    };
    if (!key || !selectors[key]) return;
    const target = rootRef.current?.querySelector<HTMLElement>(selectors[key]);
    target?.scrollIntoView?.({ block: 'nearest' });
    target?.focus();
  }, [fieldErrors]);
  const hub = useHubModules();

  const moduleActive =
    speechAnalyticsModuleActive ??
    hub.active.some((m) => m.code === 'speech_analytics' && m.licenseStatus === 'active');

  const showProjectSelect = moduleActive && record;

  const projectsQuery = useGetSaProjectsQuery(undefined, {
    skip: !showProjectSelect || analyticsProjectsProp !== undefined,
  });

  const projects = useMemo((): AnalyticsProjectOption[] => {
    if (analyticsProjectsProp) return analyticsProjectsProp;
    return (projectsQuery.data ?? []).map((p) => ({ id: p.id, name: p.name }));
  }, [analyticsProjectsProp, projectsQuery.data]);

  const projectsLoading =
    analyticsProjectsLoadingProp ?? (!analyticsProjectsProp && projectsQuery.isLoading);
  const projectsError =
    analyticsProjectsErrorProp ?? (!analyticsProjectsProp && projectsQuery.isError);

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

  const selectValue = projects.some((p) => p.id === analyticsProjectId) ? analyticsProjectId : '';

  return (
    <Flex
      ref={rootRef}
      direction="column"
      align="stretch"
      gap="16"
      max
      className={styles.generalForm}
    >
      <VStack
        as="section"
        gap="16"
        max
        className={styles.settingsBlock}
        aria-labelledby={sectionId + '-identity'}
      >
        <HStack gap="12" justify="between" className={styles.blockHeader} max>
          <HStack gap="12"><Route size={18} aria-hidden="true" className={styles.blockIcon} />
            <Text as="h3" variant="small" id={sectionId + '-identity'}>{t('routes.generalBlocks.identity', 'Параметры маршрута')}</Text>
          </HStack>
          <HStack gap="8" className={styles.activeToggle}>
            <Label htmlFor="route-active">{t('common.active', 'Активен')}</Label>
            <Switch id="route-active" checked={active} onCheckedChange={setActive} />
          </HStack>
        </HStack>
        {/* Name + Context in one responsive row */}
        <HStack gap="12" align="stretch" wrap="wrap" max className={styles.nameContextRow}>
          <VStack gap="4" className={styles.nameContextField}>
            <Label htmlFor="route-name">{t('routes.name', 'Наименование маршрута')}</Label>
            <Input
              id="route-name"
              aria-invalid={!!fieldErrors?.name || undefined}
              aria-describedby={fieldErrors?.name ? 'route-name-error' : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('routes.namePlaceholder', 'Входящий городской')}
            />
            {fieldErrors?.name && (
              <Text id="route-name-error" variant="error" role="alert">
                {fieldErrors.name}
              </Text>
            )}
          </VStack>

          <VStack gap="4" className={styles.nameContextField}>
            <Label htmlFor="route-context">{t('routes.context', 'Контекст')} *</Label>
            <Select
              id="route-context"
              aria-invalid={!!fieldErrors?.context_uid || undefined}
              aria-describedby={fieldErrors?.context_uid ? 'route-context-error' : undefined}
              value={contextUid ?? ''}
              onChange={(e) => setContextUid(Number(e.target.value))}
            >
              <option value="" disabled>
                {t('routes.selectContext', 'Выберите контекст')}
              </option>
              {contexts.map((ctx) => (
                <option key={ctx.uid} value={ctx.uid}>
                  {ctx.name} {ctx.comment ? `(${ctx.comment})` : ''}
                </option>
              ))}
            </Select>
            {fieldErrors?.context_uid && (
              <Text id="route-context-error" variant="error" role="alert">
                {fieldErrors.context_uid}
              </Text>
            )}
          </VStack>
        </HStack>
      </VStack>
      <VStack
        as="section"
        gap="16"
        max
        className={styles.settingsBlock}
        aria-labelledby={sectionId + '-matching'}
      >
        <HStack gap="12" className={styles.blockHeader} max>
          <ListFilter size={18} aria-hidden="true" className={styles.blockIcon} />
          <Text as="h3" variant="small" id={sectionId + '-matching'}>
            {t('routes.generalBlocks.matching', 'Условия выбора маршрута')}
          </Text>
        </HStack>
        <VStack gap="4" max data-field-key="extensions">
          <ExtensionChips
            value={extensions}
            onChange={setExtensions}
            onDraftChange={props.onRuleDraftChange}
          />
          {fieldErrors?.extensions && (
            <Text variant="error" role="alert">
              {fieldErrors.extensions}
            </Text>
          )}
        </VStack>
      </VStack>
      <VStack
        as="section"
        gap="16"
        max
        className={styles.settingsBlock}
        aria-labelledby={sectionId + '-processing'}
      >
        <Button type="button" variant="ghost" className={styles.collapseHeader} aria-expanded={processingExpanded} aria-controls={sectionId+'-processing-content'} onClick={()=>setProcessingExpanded(value=>!value)}>
          <HStack gap="12"><AudioLines size={18} aria-hidden="true" className={styles.blockIcon} />
            <Text as="h3" variant="small" id={sectionId+'-processing'}>{t('routes.generalBlocks.processing', 'Запись и аналитика')}</Text>
          </HStack>
          <ChevronDown size={18} className={processingExpanded ? styles.chevronExpanded : undefined} aria-hidden="true" />
        </Button>
        {processingExpanded && <VStack id={sectionId+'-processing-content'} gap="16" align="stretch" max>
        {/* Recording - select for when; stereo checkbox appears when recording is on */}
        <VStack gap="4" max>
          <HStack gap="4" align="center">
            <Label htmlFor="route-record-mode">{t('routes.recordMode', 'Запись разговоров')}</Label>
            <InfoTooltip
              text={t(
                'routes.recordModeTooltip',
                'При соединении - запись начинается после ответа. Все вызовы - запись ведётся с момента входящего вызова, включая ожидание и IVR.',
              )}
            />
          </HStack>
          <Select
            id="route-record-mode"
            value={encodeRecordMode(record, recordAll)}
            onChange={(e) => handleRecordModeChange(e.target.value)}
          >
            <option value="off">{t('routes.recordOff', 'Не записывать')}</option>
            <option value="calls">{t('routes.recordCalls', 'При соединении')}</option>
            <option value="all">
              {t('routes.recordAllCalls', 'Все вызовы (включая без соединения)')}
            </option>
          </Select>
          {record && (
            <HStack align="center" justify="between" gap="12" max className={styles.toggleRow}>
              <HStack gap="4" align="center" className={styles.toggleLabel}>
                <Label className="cursor-pointer" htmlFor="route-record-stereo">
                  {t('routes.recordStereo', 'Стерео (раздельные каналы)')}
                </Label>
                <InfoTooltip
                  text={t(
                    'routes.recordStereoTooltip',
                    'Входящий и исходящий аудиопоток записываются в отдельные дорожки стереофайла.',
                  )}
                />
              </HStack>
              <Switch
                id="route-record-stereo"
                checked={recordStereo}
                onCheckedChange={(checked) => setRecordStereo(checked)}
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
              <QueryErrorState
                message={t(
                  'speechAnalytics.errorLoadProjects',
                  'Could not load projects. Try again.',
                )}
                onRetry={() => {
                  if (onRetryAnalyticsProjects) onRetryAnalyticsProjects();
                  else void projectsQuery.refetch();
                }}
                retryLabel={t('speechAnalytics.retry', 'Retry')}
              />
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
        </VStack>}
      </VStack>
    </Flex>
  );
});

RouteGeneralTab.displayName = 'RouteGeneralTab';
