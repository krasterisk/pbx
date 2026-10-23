import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Terminal, Mic2, Shield, Cpu, Database, Route, Bot, Table2, Phone, AudioLines } from 'lucide-react';
import { Button, InfoTooltip, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetAuthConfigQuery } from '@/shared/api/endpoints/authApi';
import { DialplanSubroutinesCard } from '@/features/system-settings/ui/DialplanSubroutinesCard';
import { RecordingsCard } from '@/features/system-settings/ui/RecordingsCard';
import { WebhookSecurityCard } from '@/features/system-settings/ui/WebhookSecurityCard';
import { FfmpegStatusCard } from '@/features/system-settings/ui/FfmpegStatusCard';
import { RedisStatusCard } from '@/features/system-settings/ui/RedisStatusCard';
import { TenantSettingsSection } from '@/features/tenant-settings/ui/TenantSettingsSection';
import { TablePageSizeSetting } from '@/features/tenant-settings/ui/TablePageSizeSetting/TablePageSizeSetting';
import { EndpointExpertModeSetting } from '@/features/tenant-settings/ui/EndpointExpertModeSetting/EndpointExpertModeSetting';
import { AiChatProviderCard } from '@/features/system-settings/ui/AiChatProviderCard';
import { TenantSpeechModelsCard } from '@/features/speechAnalytics/ui/TenantSpeechModelsCard/TenantSpeechModelsCard';
import { useGetSaSpeechModelsQuery } from '@/features/speechAnalytics/api/speechAnalyticsApi';
import { OrganizationTimezoneSetting } from '@/features/system-settings/ui/OrganizationTimezoneSetting/OrganizationTimezoneSetting';
import cls from './SettingsPage.module.scss';

type Tab = 'general' | 'telephony' | 'ai' | 'server';
const SECTIONS = [
  { key: 'timezone', tab: 'general', icon: Settings, titleKey: 'calls.calendarSettingsTitle', descKey: '', content: <OrganizationTimezoneSetting /> },
  { key: 'tables', tab: 'general', icon: Table2, titleKey: 'systemSettings.sectionTables', descKey: '', content: <TablePageSizeSetting /> },
  { key: 'endpoints', tab: 'telephony', icon: Phone, titleKey: 'endpoints.title', descKey: '', content: <EndpointExpertModeSetting /> },
  { key: 'tenant', tab: 'telephony', icon: Route, titleKey: 'systemSettings.sectionRoutes', descKey: 'systemSettings.sectionRoutesDesc' },
  { key: 'speechModels', tab: 'ai', icon: AudioLines, titleKey: 'speechAnalytics.tenantModelsTitle', descKey: 'speechAnalytics.tenantModelsHint', content: <TenantSpeechModelsCard /> },
  { key: 'aiChat', tab: 'ai', icon: Bot, titleKey: 'systemSettings.sectionAiAgent', descKey: '' },
  { key: 'dialplan', tab: 'server', icon: Terminal, titleKey: 'systemSettings.sectionDialplan', descKey: 'systemSettings.sectionDialplanDesc', content: <DialplanSubroutinesCard /> },
  { key: 'recordings', tab: 'server', icon: Mic2, titleKey: 'systemSettings.sectionRecordings', descKey: 'systemSettings.sectionRecordingsDesc', content: <RecordingsCard /> },
  { key: 'security', tab: 'server', icon: Shield, titleKey: 'systemSettings.sectionSecurity', descKey: 'systemSettings.sectionSecurityDesc', content: <WebhookSecurityCard /> },
  { key: 'ffmpeg', tab: 'server', icon: Cpu, titleKey: 'systemSettings.sectionFfmpeg', descKey: 'systemSettings.sectionFfmpegDesc', content: <FfmpegStatusCard /> },
  { key: 'redis', tab: 'server', icon: Database, titleKey: 'systemSettings.sectionRedis', descKey: 'systemSettings.sectionRedisDesc', content: <RedisStatusCard /> },
] as const;

export function SettingsPage() {
  const { t } = useTranslation();
  const { data: config, isError, refetch } = useGetAuthConfigQuery();
  const { data: speechModels } = useGetSaSpeechModelsQuery(undefined, { skip: !config });
  const [selected, setSelected] = useState<Tab>('general');
  const installation = config?.deploymentMode === 'box' || config?.deploymentMode === 'opensource';
  const tabs: Tab[] = ['general', 'telephony', ...(speechModels?.ownModels ? ['ai' as const] : []), ...(installation ? ['server' as const] : [])];
  const active = tabs.includes(selected) ? selected : 'general';
  return <VStack gap="24" max className={cls.page} data-testid="settings-page-responsive" data-stack="phone">
    <HStack gap="12" align="center" className={cls.heading}>
      <Settings className={cls.pageIcon} />
      <Text variant="h1" className={cls.pageTitle}>{t('systemSettings.pageTitle')}</Text>
    </HStack>
    {!config ? isError
      ? <HStack gap="12"><Text role="alert" variant="error">{t('systemSettings.modeError')}</Text><Button variant="outline" size="sm" onClick={() => refetch()}>{t('common.retry')}</Button></HStack>
      : <VStack max gap="16"><Skeleton height={40} /><Skeleton height={180} /></VStack>
      : <Tabs value={active} onValueChange={value => setSelected(value as Tab)} className={cls.tabs}>
        <TabsList aria-label={t('systemSettings.sectionsLabel')}>
          {tabs.map(tab => <TabsTrigger key={tab} value={tab}>{t(`systemSettings.tabs.${tab}`)}</TabsTrigger>)}
        </TabsList>
        {tabs.map(tab => <TabsContent key={tab} value={tab}>
          <VStack gap="24" max>
            {SECTIONS.filter(section => section.tab === tab).map(section => {
              const Icon = section.icon;
              return <VStack key={section.key} gap="12" className={cls.section} max>
                <HStack gap="8" align="center" className={cls.sectionHeader}>
                  <Icon className={cls.sectionIcon} />
                  <Text className={cls.sectionTitle}>{t(section.titleKey)}</Text>
                  {section.descKey && <InfoTooltip text={t(section.descKey)} />}
                </HStack>
                <VStack align="stretch" className={cls.sectionBody}>{section.key === 'tenant' ? <TenantSettingsSection allowRawDialplan={installation} /> : section.key === 'aiChat' ? <AiChatProviderCard ownModels={Boolean(speechModels?.ownModels)} /> : section.content}</VStack>
              </VStack>;
            })}
          </VStack>
        </TabsContent>)}
      </Tabs>}
  </VStack>;
}
