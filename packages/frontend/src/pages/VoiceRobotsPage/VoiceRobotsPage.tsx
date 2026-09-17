import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { VoiceRobotsTable } from '@/features/voiceRobots/ui/VoiceRobotsTable';
import cls from './VoiceRobotsPage.module.scss';

const VoiceRobotsPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleCreate = useCallback(() => {
    navigate('/voice-robots/create');
  }, [navigate]);

  return (
    <VStack gap="24" max className={cls.page} data-testid="voice-robots-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Bot size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('voiceRobots.title')}
            </Text>
            <Text variant="muted">
              {t('voiceRobots.subtitle')}
            </Text>
          </VStack>
        </HStack>
        <Button className={cls.createBtn} onClick={handleCreate}>
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('voiceRobots.create')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <VoiceRobotsTable />
      </Flex>
    </VStack>
  );
});

VoiceRobotsPage.displayName = 'VoiceRobotsPage';

export default VoiceRobotsPage;
