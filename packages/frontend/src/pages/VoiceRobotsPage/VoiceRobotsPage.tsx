import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Flex, VStack, Text } from '@/shared/ui';
import { VoiceRobotsTable } from '@/features/voiceRobots/ui/VoiceRobotsTable/VoiceRobotsTable';
import { VoiceRobotFormModal } from '@/features/voiceRobots/ui/VoiceRobotFormModal/VoiceRobotFormModal';
import { useGetVoiceRobotsQuery, useDeleteVoiceRobotMutation } from '@/shared/api/endpoints/voiceRobotsApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { voiceRobotsActions } from '@/features/voiceRobots';
import { IVoiceRobot } from '@/entities/voiceRobot';

const VoiceRobotsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { data: robots = [], isLoading } = useGetVoiceRobotsQuery();
  const [deleteRobot] = useDeleteVoiceRobotMutation();

  const handleEdit = useCallback((robot: IVoiceRobot) => {
    dispatch(voiceRobotsActions.openModal(robot));
  }, [dispatch]);

  const handleCreate = useCallback(() => {
    dispatch(voiceRobotsActions.openModal(null));
  }, [dispatch]);

  const handleDelete = useCallback((robot: IVoiceRobot) => {
    if (confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить этот элемент?'))) {
      deleteRobot(robot.uid);
    }
  }, [deleteRobot, t]);

  return (
    <VStack gap="24" max className="flex-1">
      <Flex justify="between" align="center" className="px-2">
        <Flex align="center" gap="12">
          <Flex align="center" justify="center" className="p-2.5 bg-indigo-500/10 rounded-xl">
            <Bot className="w-6 h-6 text-indigo-500" />
          </Flex>
          <VStack>
             <Text variant="h1" className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('voiceRobots.title', 'Голосовые роботы (AI PBX)')}
            </Text>
            <Text variant="muted" className="mt-1">
              {t('voiceRobots.subtitle', 'Настройка STT/TTS роботов, правил VAD и цепочек ключевых слов')}
            </Text>
          </VStack>
        </Flex>
        <Button onClick={handleCreate} className="shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />
          {t('voiceRobots.create', 'Создать робота')}
        </Button>
      </Flex>

      <Card className="border-muted/50 shadow-sm backdrop-blur-xl bg-background/50">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <CardTitle className="text-base font-medium">
            {t('voiceRobots.list', 'Список роботов')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <VoiceRobotsTable
            data={robots}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <VoiceRobotFormModal />
    </VStack>
  );
});

VoiceRobotsPage.displayName = 'VoiceRobotsPage';

export default VoiceRobotsPage;
