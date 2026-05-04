import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { IDialplanAppProps } from '../../../model/types';
import { Text } from '@/shared/ui/Text/Text';

/**
 * Fallback app that renders generic inputs based on the ActionType.
 * As the project scales, each of these switch cases should become a dedicated App component.
 */
export const GenericApp = memo(({ action, onUpdate }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const p = action.params;
  const id = action.id;

  const handleUpdate = (field: string, value: string) => {
    onUpdate(id, `params.${field}`, value);
  };

  switch (action.type) {
    case 'togroup':
      return <Input className="w-full" value={p.group || ''} onChange={(e) => handleUpdate('group', e.target.value)} placeholder={t('routes.apps.group.number', 'Номер группы')} />;
    case 'tolist':
      return (
        <HStack gap="8" className="w-full">
          <Input className="flex-1" value={p.numbers || ''} onChange={(e) => handleUpdate('numbers', e.target.value)} placeholder={t('routes.apps.list.numbers', '100,101,102')} />
          <Input className="w-[60px]" value={p.timeout || ''} onChange={(e) => handleUpdate('timeout', e.target.value)} placeholder={t('routes.apps.common.timeout', 'Таймаут, сек')} />
        </HStack>
      );
    case 'setclid_custom':
      return <Input className="w-full" value={p.callerid || ''} onChange={(e) => handleUpdate('callerid', e.target.value)} placeholder={t('routes.apps.clid.callerid', 'CallerID')} />;
    case 'setclid_list':
      return <Input className="w-full" value={p.list_uid || ''} onChange={(e) => handleUpdate('list_uid', e.target.value)} placeholder={t('routes.apps.clid.listId', 'ID списка')} />;
    case 'sendmail':
      return (
        <VStack gap="4" className="w-full">
          <HStack gap="8" className="w-full">
            <Input className="w-[180px]" value={p.email || ''} onChange={(e) => handleUpdate('email', e.target.value)} placeholder={t('routes.apps.mail.email', 'email@example.com')} />
            <Input className="flex-1" value={p.subject || ''} onChange={(e) => handleUpdate('subject', e.target.value)} placeholder={t('routes.apps.mail.subjectHint', 'Тема — ${CALLERID(num)}')} />
            <InfoTooltip text={t('routes.apps.mail.variablesHint',
              'Переменные Asterisk:\n${CALLERID(num)} — номер звонящего\n${CALLERID(name)} — имя звонящего\n${EXTEN} — набранный номер\n${UNIQUEID} — ID звонка\n${EPOCH} — время (unix)\n${STRFTIME(${EPOCH},,%d.%m.%Y %H:%M)} — дата/время\n${CDR(duration)} — длительность\n\nПример темы:\nЗвонок от ${CALLERID(num)} на ${EXTEN}'
            )} />
          </HStack>
          <Input className="w-full" value={p.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} placeholder={t('routes.apps.mail.textHint', 'Текст — Входящий вызов от ${CALLERID(num)} на ${EXTEN}')} />
        </VStack>
      );
    case 'telegram':
      return (
        <HStack gap="8" className="w-full">
          <Input className="w-[150px]" value={p.chat_id || ''} onChange={(e) => handleUpdate('chat_id', e.target.value)} placeholder={t('routes.apps.telegram.chatId', 'Chat ID')} />
          <Input className="flex-1" value={p.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} placeholder={t('routes.apps.common.text', 'Текст...')} />
        </HStack>
      );
    case 'voicemail':
    case 'sendmailpeer':
      return <Input className="w-full" value={p.exten || ''} onChange={(e) => handleUpdate('exten', e.target.value)} placeholder={t('routes.apps.common.exten', 'Номер абонента')} />;
    case 'text2speech':
      return <Input className="w-full" value={p.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} placeholder={t('routes.apps.tts.text', 'Текст для синтеза...')} />;
    case 'asr':
    case 'keywords':
      return (
        <HStack gap="8" className="w-full">
          <Input className="w-[80px]" value={p.silence_timeout || ''} onChange={(e) => handleUpdate('silence_timeout', e.target.value)} placeholder={t('routes.apps.asr.silence', 'Тишина')} />
          <Input className="w-[80px]" value={p.max_timer || ''} onChange={(e) => handleUpdate('max_timer', e.target.value)} placeholder={t('routes.apps.asr.maxTimer', 'Длина')} />
        </HStack>
      );
    case 'webhook':
      return <Input className="w-full" value={p.url || ''} onChange={(e) => handleUpdate('url', e.target.value)} placeholder={t('routes.apps.webhook.url', 'https://...')} />;
    case 'confbridge':
      return <Input className="w-full" value={p.room || ''} onChange={(e) => handleUpdate('room', e.target.value)} placeholder={t('routes.apps.confbridge.room', 'Комната')} />;
    case 'cmd':
      return <Input className="w-full" value={p.command || ''} onChange={(e) => handleUpdate('command', e.target.value)} placeholder={t('routes.apps.cmd.command', 'Команда dialplan...')} />;
    case 'tofax':
      return <Input className="w-full" value={p.email || ''} onChange={(e) => handleUpdate('email', e.target.value)} placeholder={t('routes.apps.fax.email', 'Email доставки')} />;
    case 'label':
      return <Input className="w-full" value={p.label_name || ''} onChange={(e) => handleUpdate('label_name', e.target.value)} placeholder={t('routes.apps.label.name', 'Имя метки')} />;
    case 'busy':
      return <Input type="number" min={0} step={1} className="w-[100px]" value={p.timeout || ''} onChange={(e) => handleUpdate('timeout', e.target.value)} placeholder={t('routes.apps.common.timeout', 'Сек')} />;
    default:
      return <Text variant="small" className="text-muted-foreground">—</Text>;
  }
});

GenericApp.displayName = 'GenericApp';
