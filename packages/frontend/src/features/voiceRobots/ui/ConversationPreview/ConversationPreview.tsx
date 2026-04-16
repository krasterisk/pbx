import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Bot, User, Clock, ArrowRight, Globe, PhoneForwarded, Users as UsersIcon, PhoneOff } from 'lucide-react';
import { VStack, Text } from '@/shared/ui';
import { IVoiceRobotBotAction } from '@/entities/voiceRobot';
import cls from './ConversationPreview.module.scss';

interface ConversationPreviewProps {
  keyword: string;
  action: IVoiceRobotBotAction;
  greetingText?: string;
}

/**
 * ConversationPreview — readonly visualization of a dialogue scenario.
 *
 * Generates a step-by-step conversation preview from the keyword + bot action config.
 * Shows: greeting → keyword match → response → slot collection → next state.
 *
 * FSD layer: features/voiceRobots/ui
 */
export const ConversationPreview = memo(({ keyword, action, greetingText }: ConversationPreviewProps) => {
  const { t } = useTranslation();

  const nextStateLabels: Record<string, { label: string; Icon: typeof Bot }> = {
    listen: { label: t('voiceRobots.nextStateDescriptions.listen', 'Робот ждёт следующую фразу клиента'), Icon: Bot },
    switch_group: { label: t('voiceRobots.nextStateDescriptions.switch_group', 'Робот перейдёт к другому набору сценариев'), Icon: ArrowRight },
    transfer_queue: { label: t('voiceRobots.nextStateDescriptions.transfer_queue', 'Звонок попадёт в очередь ожидания'), Icon: UsersIcon },
    transfer_exten: { label: t('voiceRobots.nextStateDescriptions.transfer_exten', 'Звонок переведётся на указанный номер'), Icon: PhoneForwarded },
    webhook: { label: t('voiceRobots.nextStateDescriptions.webhook', 'Робот отправит данные на сервер'), Icon: Globe },
    hangup: { label: t('voiceRobots.nextStateDescriptions.hangup', 'Звонок будет завершён'), Icon: PhoneOff },
  };

  const slotTypeLabels: Record<string, string> = {
    digits: t('voiceRobots.slot.digits', 'Цифры'),
    phone: t('voiceRobots.slot.phone', 'Телефон'),
    yes_no: t('voiceRobots.slot.yesNo', 'Да/Нет'),
    date: t('voiceRobots.slot.date', 'Дата'),
    choice: t('voiceRobots.slot.choice', 'Выбор из списка'),
    freetext: t('voiceRobots.slot.freetext', 'Свободный текст'),
  };

  const nextInfo = nextStateLabels[action.nextState.type] || { label: action.nextState.type, Icon: ArrowRight };

  return (
    <VStack gap="8" className={cls.previewCard}>
      <VStack className={cls.title}>
        <Eye className={cls.titleIcon} />
        <Text>{t('voiceRobots.conversationPreview.title', 'Предпросмотр сценария')}</Text>
      </VStack>

      <VStack className={cls.stepList}>
        {/* Step 1: Greeting (if configured) */}
        {greetingText && (
          <VStack className={`${cls.step} ${cls.stepBot}`}>
            <Bot className={cls.stepIcon} />
            <Text className={cls.stepText}>{greetingText}</Text>
          </VStack>
        )}

        {/* Step 2: Client speaks keyword */}
        <VStack className={`${cls.step} ${cls.stepUser}`}>
          <User className={cls.stepIcon} />
          <Text className={cls.stepMuted}>
            {t('voiceRobots.conversationPreview.clientSays', 'Клиент говорит')}: &laquo;{keyword}&raquo;
          </Text>
        </VStack>

        {/* Step 3: Bot response */}
        {action.response.type === 'tts' && action.response.value && (
          <VStack className={`${cls.step} ${cls.stepBot}`}>
            <Bot className={cls.stepIcon} />
            <Text className={cls.stepText}>{action.response.value}</Text>
          </VStack>
        )}

        {/* Step 4: Slot collection */}
        {(action.slots || []).map((slot, idx) => (
          <VStack key={idx} className={`${cls.step} ${cls.stepUser}`}>
            <Clock className={cls.stepIcon} />
            <Text className={cls.stepMuted}>
              {t('voiceRobots.conversationPreview.waitingFor', 'Ожидание ответа')}: {slot.name} ({slotTypeLabels[slot.type] || slot.type})
              {slot.prompt?.value ? ` — "${slot.prompt.value}"` : ''}
            </Text>
          </VStack>
        ))}

        {/* Step 5: Webhook URL (if webhook) */}
        {action.nextState.type === 'webhook' && action.nextState.target && (
          <VStack className={`${cls.step} ${cls.stepAction}`}>
            <Globe className={cls.stepIcon} />
            <Text className={cls.stepMuted}>
              {t('voiceRobots.conversationPreview.sendsTo', 'Отправка данных на')}: {String(action.nextState.target)}
            </Text>
          </VStack>
        )}

        {/* Step 6: Final action */}
        <VStack className={`${cls.step} ${cls.stepAction}`}>
          <nextInfo.Icon className={cls.stepIcon} />
          <Text className={cls.stepMuted}>
            {t('voiceRobots.conversationPreview.then', 'Далее')}: {nextInfo.label}
            {action.nextState.target && action.nextState.type !== 'webhook' ? ` → ${action.nextState.target}` : ''}
          </Text>
        </VStack>
      </VStack>
    </VStack>
  );
});

ConversationPreview.displayName = 'ConversationPreview';
