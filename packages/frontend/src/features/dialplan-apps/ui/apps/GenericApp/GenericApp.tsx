import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { IDialplanAppProps } from '../../../model/types';
import { Text } from '@/shared/ui/Text/Text';

/**
 * Fallback app that renders generic inputs based on the ActionType.
 * As the project scales, each of these switch cases should become a dedicated App component.
 */
export const GenericApp = memo(({ params, onChange, readOnly, actionType }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const p = params;
  const handleUpdate = (field: string, value: string) => {
    onChange({ [field]: value });
  };

  switch (actionType) {
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
    case 'voicemail':
      return <Input className="w-full" value={p.exten || ''} onChange={(e) => handleUpdate('exten', e.target.value)} placeholder={t('routes.apps.common.exten', 'Номер абонента')} />;
    case 'text2speech':
      return <Input className="w-full" value={p.text || ''} onChange={(e) => handleUpdate('text', e.target.value)} placeholder={t('routes.apps.tts.text', 'Текст для синтеза...')} />;
    case 'webhook':
      return <Input className="w-full" value={p.url || ''} onChange={(e) => handleUpdate('url', e.target.value)} placeholder={t('routes.apps.webhook.url', 'https://...')} />;
    case 'confbridge':
      return <Input className="w-full" value={p.room || ''} onChange={(e) => handleUpdate('room', e.target.value)} placeholder={t('routes.apps.confbridge.room', 'Комната')} />;
    case 'cmd':
      return <Input className="w-full" value={p.command || ''} onChange={(e) => handleUpdate('command', e.target.value)} placeholder={t('routes.apps.cmd.command', 'Команда dialplan...')} />;
    case 'label':
      return <Input className="w-full" value={p.label_name || ''} onChange={(e) => handleUpdate('label_name', e.target.value)} placeholder={t('routes.apps.label.name', 'Имя метки')} />;
    case 'busy':
      return <Input type="number" min={0} step={1} className="w-[100px]" value={p.timeout || ''} onChange={(e) => handleUpdate('timeout', e.target.value)} placeholder={t('routes.apps.common.timeout', 'Сек')} />;
    default:
      return <Text variant="small" className="text-muted-foreground">-</Text>;
  }
});

GenericApp.displayName = 'GenericApp';
