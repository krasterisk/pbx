import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Flex, VStack, Text } from '@/shared/ui';
import { useNavigate } from 'react-router-dom';
import { VoiceRobotsTable } from '@/features/voiceRobots/ui/VoiceRobotsTable/VoiceRobotsTable';
import { useGetVoiceRobotsQuery, useDeleteVoiceRobotMutation } from '@/shared/api/endpoints/voiceRobotsApi';
import { IVoiceRobot } from '@/entities/voiceRobot';
import cls from './VoiceRobotsPage.module.scss';

const VoiceRobotsPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: robots = [], isLoading } = useGetVoiceRobotsQuery();
  const [deleteRobot] = useDeleteVoiceRobotMutation();

  const handleEdit = useCallback((robot: IVoiceRobot) => {
    navigate(`/voice-robots/${robot.uid}`);
  }, [navigate]);

  const handleCreate = useCallback(() => {
    navigate('/voice-robots/create');
  }, [navigate]);

  const handleDelete = useCallback((robot: IVoiceRobot) => {
    if (confirm(t('common.confirmDelete', 'Вы уверены, что хотите удалить этот элемент?'))) {
      deleteRobot(robot.uid);
    }
  }, [deleteRobot, t]);

  const handleCopy = useCallback((robot: IVoiceRobot) => {
    navigate('/voice-robots/create', {
      state: {
        copyFrom: {
          ...robot,
          uid: undefined,
          name: `${robot.name} (${t('common.copy', 'копия')})`,
        },
      },
    });
  }, [navigate, t]);

  return (
    <VStack gap="24" max className={cls.page} data-testid="voice-robots-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <Flex align="center" gap="12" className="min-w-0">
          <Flex align="center" justify="center" className="p-2.5 bg-indigo-500/10 rounded-xl shrink-0">
            <Bot className="w-6 h-6 text-indigo-500" />
          </Flex>
          <VStack className="min-w-0">
             <Text variant="h1" className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t('voiceRobots.title', 'Голосовые роботы (AI PBX)')}
            </Text>
            <Text variant="muted" className="mt-1">
              {t('voiceRobots.subtitle', 'Настройка STT/TTS роботов, правил VAD и цепочек ключевых слов')}
            </Text>
          </VStack>
        </Flex>
        <Button onClick={handleCreate} className={`shadow-lg shadow-primary/20 ${cls.createBtn}`}>
          <Plus className="w-4 h-4 mr-2" />
          {t('voiceRobots.create', 'Создать робота')}
        </Button>
      </Flex>

      <Card className="border-muted/50 shadow-sm backdrop-blur-xl bg-background/50 min-w-0">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <CardTitle className="text-base font-medium">
            {t('voiceRobots.list', 'Список роботов')}
          </CardTitle>
        </CardHeader>
        <CardContent className={cls.cardContent}>
          <div
            className={`${cls.tableScroll} overflow-x-auto`}
            data-testid="hybrid-table"
            data-hybrid="overflow-x-auto"
          >
            <VoiceRobotsTable
              data={robots}
              isLoading={isLoading}
              onEdit={handleEdit}
              onCopy={handleCopy}
              onDelete={handleDelete}
            />
          </div>
        </CardContent>
      </Card>
    </VStack>
  );
});

VoiceRobotsPage.displayName = 'VoiceRobotsPage';

export default VoiceRobotsPage;
