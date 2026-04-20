import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot, User, ArrowRight, Globe, PhoneForwarded,
  PhoneOff, Repeat, ShieldAlert, MessageSquare, Clock, SlidersHorizontal, Volume2,
} from 'lucide-react';
import { VStack, HStack, Text } from '@/shared/ui';
import { IVoiceRobotBotAction } from '@/entities/voiceRobot';

interface ConversationPreviewProps {
  keyword: string;
  action: IVoiceRobotBotAction;
  greetingText?: string;
  maxRepeats?: number;
  escalationAction?: IVoiceRobotBotAction | null;
}

/* ──────────── Helpers ──────────── */

const Bubble = ({ variant, icon: Icon, children }: {
  variant: 'bot' | 'user' | 'system' | 'escalation';
  icon: typeof Bot;
  children: React.ReactNode;
}) => {
  const styles: Record<string, string> = {
    bot: 'bg-primary/8 border-l-[3px] border-primary/40 text-foreground',
    user: 'bg-emerald-500/8 border-l-[3px] border-emerald-500/40 text-foreground',
    system: 'bg-amber-500/8 border-l-[3px] border-amber-500/40 text-muted-foreground',
    escalation: 'bg-rose-500/8 border-l-[3px] border-rose-500/40 text-foreground',
  };
  const iconStyles: Record<string, string> = {
    bot: 'text-primary',
    user: 'text-emerald-500',
    system: 'text-amber-500',
    escalation: 'text-rose-500',
  };
  return (
    <HStack align="start" gap="4" className={`px-3 py-2.5 rounded-lg ${styles[variant]} transition-all`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconStyles[variant]}`} />
      <div className="text-[13px] leading-relaxed flex-1">{children}</div>
    </HStack>
  );
};

const Connector = ({ label }: { label?: string }) => (
  <HStack align="center" gap="2" className="pl-5">
    <div className="w-px h-4 bg-border" />
    {label && (
      <Text as="span" className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">{label}</Text>
    )}
  </HStack>
);

/* Helper to render an action flow (reused for primary + escalation) */
const ActionFlow = memo(({ action, t, variant = 'bot' }: {
  action: IVoiceRobotBotAction;
  t: any;
  variant?: 'bot' | 'escalation';
}) => {
  const nextStateIcons: Record<string, typeof Bot> = {
    listen: Bot,
    switch_group: ArrowRight,
    transfer_exten: PhoneForwarded,
    webhook: Globe,
    hangup: PhoneOff,
  };

  const nextStateLabels: Record<string, string> = {
    listen: t('voiceRobots.nextStateDescriptions.listen', 'Робот ждёт следующую фразу клиента'),
    switch_group: t('voiceRobots.nextStateDescriptions.switch_group', 'Робот перейдёт к другому набору сценариев'),
    transfer_exten: t('voiceRobots.nextStateDescriptions.transfer_exten', 'Звонок переведётся на указанный номер'),
    webhook: t('voiceRobots.nextStateDescriptions.webhook', 'Робот отправит данные на сервер'),
    hangup: t('voiceRobots.nextStateDescriptions.hangup', 'Звонок будет завершён'),
  };

  const NextIcon = nextStateIcons[action.nextState.type] || ArrowRight;
  const nextLabel = nextStateLabels[action.nextState.type] || action.nextState.type;

  return (
    <>
      {/* Response */}
      {action.response.type === 'tts' && action.response.value && (
        <>
          <Bubble variant={variant} icon={variant === 'bot' ? Bot : ShieldAlert}>
            <Text as="span" className="font-medium">«{action.response.value}»</Text>
          </Bubble>
          <Connector />
        </>
      )}
      {action.response.type === 'prompt' && action.response.value && (
        <>
          <Bubble variant={variant} icon={variant === 'bot' ? MessageSquare : ShieldAlert}>
            <HStack align="center" gap="2" className="inline-flex">
              <Volume2 className="w-4 h-4 text-amber-500" />
              <Text as="span">{t('voiceRobots.response.prompt', 'Аудио-промпт')}: {action.response.value}</Text>
            </HStack>
          </Bubble>
          <Connector />
        </>
      )}

      {/* Slot collection */}
      {(action.slots || []).length > 0 && (
        <>
          <Bubble variant="system" icon={SlidersHorizontal}>
            <VStack gap="2">
              <Text as="span" className="font-medium text-xs uppercase tracking-wider">
                {t('voiceRobots.action.slotsTitle', 'Сбор данных')}
              </Text>
              {action.slots!.map((slot, i) => (
                <Text as="span" key={i} className="text-xs">
                  • <strong>{slot.name}</strong> ({slot.type})
                  {slot.prompt?.value ? ` — «${slot.prompt.value}»` : ''}
                  {slot.maxRetries ? ` [${slot.maxRetries} ${t('voiceRobots.escalation.maxRepeats', 'попыток').toLowerCase()}]` : ''}
                </Text>
              ))}
            </VStack>
          </Bubble>
          <Connector />
        </>
      )}

      {/* Webhook URL */}
      {action.nextState.type === 'webhook' && action.nextState.target && (
        <>
          <Bubble variant="system" icon={Globe}>
            <Text as="span">POST → <code className="text-xs bg-muted px-1 py-0.5 rounded">{String(action.nextState.target)}</code></Text>
            {action.webhookResponseTemplate && (
              <Text className="mt-1 text-xs opacity-70">
                {t('voiceRobots.action.webhookResponseTemplate', 'Шаблон ответа')}: «{action.webhookResponseTemplate}»
              </Text>
            )}
          </Bubble>
          <Connector />
        </>
      )}

      {/* Final state */}
      <Bubble
        variant={action.nextState.type === 'hangup' ? 'escalation' : variant}
        icon={NextIcon}
      >
        <Text as="span" className="font-medium">{nextLabel}</Text>
        {action.nextState.target && action.nextState.type !== 'webhook' && (
          <Text as="span" className="ml-1 text-xs opacity-70">→ {String(action.nextState.target)}</Text>
        )}
      </Bubble>
    </>
  );
});
ActionFlow.displayName = 'ActionFlow';

/* ──────────── Main Component ──────────── */

/**
 * ConversationPreview — chat-style visualization of a keyword scenario.
 *
 * Shows the full dialogue flow including greeting, keyword match,
 * bot response, slot collection, next state, and escalation path.
 *
 * FSD layer: features/voiceRobots/ui
 */
export const ConversationPreview = memo(({
  keyword, action, greetingText, maxRepeats, escalationAction,
}: ConversationPreviewProps) => {
  const { t } = useTranslation();

  const hasEscalation = (maxRepeats || 0) > 0 && escalationAction;

  return (
    <VStack gap="0" className="p-4 rounded-xl border border-border bg-muted/30">
      {/* ─── Greeting ─── */}
      {greetingText && (
        <>
          <Bubble variant="bot" icon={Bot}>
            <span className="font-medium">«{greetingText}»</span>
          </Bubble>
          <Connector />
        </>
      )}

      {/* ─── Client says keyword ─── */}
      <Bubble variant="user" icon={User}>
        <Text as="span" className="italic">
          {t('voiceRobots.conversationPreview.clientSays', 'Клиент говорит')}:
        </Text>
        <Text as="span" className="ml-1.5 font-semibold">«{keyword}»</Text>
      </Bubble>
      <Connector label={hasEscalation
        ? t('voiceRobots.preview.primaryPath', 'Основной сценарий ({{count}}×)', { count: maxRepeats })
        : undefined
      } />

      {/* ─── Primary action flow ─── */}
      <ActionFlow action={action} t={t} variant="bot" />

      {/* ─── Escalation path ─── */}
      {hasEscalation && (
        <>
          <HStack align="center" gap="4" className="my-3">
            <div className="flex-1 h-px bg-rose-500/20" />
            <HStack gap="4" align="center">
              <Repeat className="w-3.5 h-3.5 text-rose-500" />
              <Text as="span" className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">
                {t('voiceRobots.preview.escalationPath', 'Повтор ({{count}}+ раз)', { count: (maxRepeats || 0) + 1 })}
              </Text>
            </HStack>
            <div className="flex-1 h-px bg-rose-500/20" />
          </HStack>

          {/* Client repeats */}
          <Bubble variant="user" icon={User}>
            <Text as="span" className="italic">
              {t('voiceRobots.conversationPreview.clientSays', 'Клиент говорит')}:
            </Text>
            <Text as="span" className="ml-1.5 font-semibold">«{keyword}»</Text>
            <Text as="span" className="ml-1.5 text-xs text-rose-500 font-medium">
              ({t('voiceRobots.preview.repeatedAgain', 'повторно')})
            </Text>
          </Bubble>
          <Connector />

          <ActionFlow action={escalationAction!} t={t} variant="escalation" />
        </>
      )}
    </VStack>
  );
});

ConversationPreview.displayName = 'ConversationPreview';
