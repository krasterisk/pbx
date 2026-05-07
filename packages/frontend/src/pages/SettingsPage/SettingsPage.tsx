import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Settings, Terminal, Mic2, Shield, Cpu, Database } from 'lucide-react';
import { Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { DialplanSubroutinesCard } from '@/features/system-settings/ui/DialplanSubroutinesCard';
import { RecordingsCard } from '@/features/system-settings/ui/RecordingsCard';
import { WebhookSecurityCard } from '@/features/system-settings/ui/WebhookSecurityCard';
import { FfmpegStatusCard } from '@/features/system-settings/ui/FfmpegStatusCard';
import { RedisStatusCard } from '@/features/system-settings/ui/RedisStatusCard';
import cls from './SettingsPage.module.scss';

const SECTIONS = [
  {
    key: 'dialplan',
    icon: Terminal,
    titleKey: 'systemSettings.sectionDialplan',
    descKey: 'systemSettings.sectionDialplanDesc',
    content: <DialplanSubroutinesCard />,
  },
  {
    key: 'recordings',
    icon: Mic2,
    titleKey: 'systemSettings.sectionRecordings',
    descKey: 'systemSettings.sectionRecordingsDesc',
    content: <RecordingsCard />,
  },
  {
    key: 'security',
    icon: Shield,
    titleKey: 'systemSettings.sectionSecurity',
    descKey: 'systemSettings.sectionSecurityDesc',
    content: <WebhookSecurityCard />,
  },
  {
    key: 'ffmpeg',
    icon: Cpu,
    titleKey: 'systemSettings.sectionFfmpeg',
    descKey: 'systemSettings.sectionFfmpegDesc',
    content: <FfmpegStatusCard />,
  },
  {
    key: 'redis',
    icon: Database,
    titleKey: 'systemSettings.sectionRedis',
    descKey: 'systemSettings.sectionRedisDesc',
    content: <RedisStatusCard />,
  },
] as const;

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <VStack gap="32" max className={cls.page}>
      {/* Header */}
      <HStack gap="12" align="center">
        <Settings className={cls.pageIcon} />
        <VStack gap="4">
          <Text variant="h1" className={cls.pageTitle}>{t('systemSettings.pageTitle')}</Text>
          <Text variant="small" className={cls.pageSubtitle}>{t('systemSettings.pageSubtitle')}</Text>
        </VStack>
      </HStack>

      {/* Sections */}
      {SECTIONS.map((section, i) => {
        const Icon = section.icon;
        return (
          <motion.div
            key={section.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className={cls.section}
          >
            <VStack gap="16">
              <HStack gap="8" align="center" className={cls.sectionHeader}>
                <Icon className={cls.sectionIcon} />
                <VStack gap="2">
                  <Text className={cls.sectionTitle}>{t(section.titleKey)}</Text>
                  <Text variant="small" className={cls.sectionDesc}>{t(section.descKey)}</Text>
                </VStack>
              </HStack>
              {section.content}
            </VStack>
          </motion.div>
        );
      })}
    </VStack>
  );
}
