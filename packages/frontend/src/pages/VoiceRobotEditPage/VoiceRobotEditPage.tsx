import { memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, ArrowLeft } from 'lucide-react';
import { Button, Text, Flex, VStack } from '@/shared/ui';
import { VoiceRobotForm } from '@/features/voiceRobots/ui/VoiceRobotForm';
import { useGetVoiceRobotQuery } from '@/shared/api/endpoints/voiceRobotsApi';

const VoiceRobotEditPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const isCreateMode = !id || id === 'create';
  
  // Use skip if we are in create mode
  const { data: robot, isLoading } = useGetVoiceRobotQuery(Number(id), {
    skip: isCreateMode || isNaN(Number(id)),
  });

  const handleBack = () => {
    navigate('/voice-robots');
  };

  return (
    <VStack max gap="24" className="flex-1 overflow-hidden">
      {/* Page Header */}
      <Flex justify="between" align="center" className="px-2 shrink-0">
        <Flex align="center" gap="12">
          <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full w-10 h-10 bg-muted/20 hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Flex align="center" justify="center" className="p-2.5 bg-indigo-500/10 rounded-xl">
            <Bot className="w-6 h-6 text-indigo-500" />
          </Flex>
          <VStack>
             <Text variant="h1" className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {isCreateMode 
                ? t('voiceRobots.createTitle', 'Создание голосового робота') 
                : t('voiceRobots.editTitle', 'Редактирование робота')}
            </Text>
            <Text variant="muted" className="mt-1">
              {robot ? robot.name : t('voiceRobots.subtitleNew', 'Настройте поведение и логику нового ассистента')}
            </Text>
          </VStack>
        </Flex>
      </Flex>

      {/* Form Content Area */}
      <VStack max className="flex-1 relative overflow-hidden">
        {isLoading && !isCreateMode ? (
          <Flex justify="center" align="center" className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 rounded-xl">
             <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
          </Flex>
        ) : (
          <VoiceRobotForm initialRobot={isCreateMode ? null : robot} />
        )}
      </VStack>
    </VStack>
  );
});

VoiceRobotEditPage.displayName = 'VoiceRobotEditPage';

export default VoiceRobotEditPage;
