import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { IDialplanAppProps } from '../../model/types';
import { Text } from '@/shared/ui/Text/Text';
/**
 * Fallback app that renders generic inputs based on the ActionType, 
 * reusing the logic from the old RouteActionsEditor.
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
      return <Input className="w-full" value={p.group || ''} onChange={(e) => handleUpdate('group', e.target.value)} placeholder="Номер группы" />;
    case 'tolist':
      return (
        <HStack gap="8" className="w-full">
          <Input className="flex-1" value={p.numbers || ''} onChange={(e) => handleUpdate('numbers', e.target.value)} placeholder="100,101,102" />
          <Input className="w-[60px]" value={p.timeout || ''} onChange={(e) => handleUpdate('timeout', e.target.value)} placeholder="сек" />
        </HStack>
      );
    case 'toroute':
      return (
        <HStack gap="8" className="w-full">
          <Input className="w-[120px]" value={p.context || ''} onChange={(e) => handleUpdate('context', e.target.value)} placeholder="Контекст" />
          <Input className="flex-1" value={p.extension || ''} onChange={(e) => handleUpdate('extension', e.target.value)} placeholder="Правило" />
        </HStack>
      );
    case 'setclid_custom':
      return <Input className="w-full" value={p.callerid || ''} onChange={(e) => handleUpdate('callerid', e.target.value)} placeholder="CallerID" />;
    case 'setclid_list':
      return <Input className="w-full" value={p.list_uid || ''} onChange={(e) => handleUpdate('list_uid', e.target.value)} placeholder="ID списка" />;
    case 'sendmail':
      return (
        <HStack gap="8" className="w-full">
          <Input className="w-[180px]" value={p.email || ''} onChange={(e) => handleUpdate('email', e.target.value)} placeholder="email@example.com" />
          <Input className="flex-1" value={p.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} placeholder="Текст..." />
        </HStack>
      );
    case 'telegram':
      return (
        <HStack gap="8" className="w-full">
          <Input className="w-[150px]" value={p.chat_id || ''} onChange={(e) => handleUpdate('chat_id', e.target.value)} placeholder="Chat ID" />
          <Input className="flex-1" value={p.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} placeholder="Текст..." />
        </HStack>
      );
    case 'voicemail':
    case 'sendmailpeer':
      return <Input className="w-full" value={p.exten || ''} onChange={(e) => handleUpdate('exten', e.target.value)} placeholder="Номер абонента" />;
    case 'text2speech':
      return <Input className="w-full" value={p.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} placeholder="Текст для синтеза..." />;
    case 'asr':
    case 'keywords':
      return (
        <HStack gap="8" className="w-full">
          <Input className="w-[80px]" value={p.silence_timeout || ''} onChange={(e) => handleUpdate('silence_timeout', e.target.value)} placeholder="Тишина (сек)" />
          <Input className="w-[80px]" value={p.max_timer || ''} onChange={(e) => handleUpdate('max_timer', e.target.value)} placeholder="Длина (сек)" />
        </HStack>
      );
    case 'webhook':
      return <Input className="w-full" value={p.url || ''} onChange={(e) => handleUpdate('url', e.target.value)} placeholder="https://..." />;
    case 'confbridge':
      return <Input className="w-full" value={p.room || ''} onChange={(e) => handleUpdate('room', e.target.value)} placeholder="Комната" />;
    case 'cmd':
      return <Input className="w-full" value={p.command || ''} onChange={(e) => handleUpdate('command', e.target.value)} placeholder="Команда dialplan..." />;
    case 'tofax':
      return <Input className="w-full" value={p.email || ''} onChange={(e) => handleUpdate('email', e.target.value)} placeholder="Email доставки" />;
    case 'label':
      return <Input className="w-full" value={p.label_name || ''} onChange={(e) => handleUpdate('label_name', e.target.value)} placeholder="Имя метки" />;
    case 'busy':
      return <Input className="w-[80px]" value={p.timeout || ''} onChange={(e) => handleUpdate('timeout', e.target.value)} placeholder="сек" />;
    case 'hangup':
    default:
      return <Text variant="small" className="text-muted-foreground">—</Text>;
  }
});

GenericApp.displayName = 'GenericApp';
