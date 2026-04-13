import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Webhook, Speech, Phone } from 'lucide-react';
import { Button, DataTable, HStack, Tooltip, VStack, Text, Flex } from '@/shared/ui';
import { IVoiceRobot } from '@/entities/voiceRobot';

interface VoiceRobotsTableProps {
  data: IVoiceRobot[];
  isLoading: boolean;
  onEdit: (robot: IVoiceRobot) => void;
  onDelete: (robot: IVoiceRobot) => void;
}

export function VoiceRobotsTable({ data, isLoading, onEdit, onDelete }: VoiceRobotsTableProps) {
  const { t } = useTranslation();

  const columns = [
    {
      accessorKey: 'uid',
      header: 'ID',
    },
    {
      accessorKey: 'name',
      header: t('voiceRobots.name', 'Название робота'),
      cell: ({ row }: any) => {
        const item = row.original as IVoiceRobot;
        return (
          <VStack>
            <Text className="font-medium text-foreground">{item.name}</Text>
          </VStack>
        );
      },
    },
    {
      accessorKey: 'active',
      header: t('common.status', 'Статус'),
      cell: ({ row }: any) => {
        const active = row.original.active;
        return (
          <Text variant="xs" className={`w-fit px-2 py-1 rounded ${active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {active ? t('common.active', 'Активен') : t('common.disabled', 'Выключен')}
          </Text>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }: any) => {
        const item = row.original as IVoiceRobot;
        return (
          <HStack justify="end" gap="8">
            <Tooltip content={t('common.edit', 'Редактировать')}>
              <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                <Pencil className="w-4 h-4 text-blue-400" />
              </Button>
            </Tooltip>
            <Tooltip content={t('common.delete', 'Удалить')}>
              <Button variant="ghost" size="icon" onClick={() => onDelete(item)}>
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </Tooltip>
          </HStack>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      searchField="name"
      searchPlaceholder={t('voiceRobots.search', 'Поиск по названию...')}
    />
  );
}
