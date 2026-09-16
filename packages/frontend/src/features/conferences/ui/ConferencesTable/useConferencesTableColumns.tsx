import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { Badge, TableRowActions, TableRowAction, Text } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import type {
  ConferenceEntryStrictness,
  ConferenceRecordMode,
  ConferenceRoomKind,
} from '@/shared/api/endpoints/conferenceRoomApi';
import { conferencesPageActions } from '../../model/slice/conferencesPageSlice';
import type { ConferenceListRow } from './conferenceListRow';
import cls from './ConferencesTable.module.scss';

const columnHelper = createColumnHelper<ConferenceListRow>();

export function formatRoomKind(kind: ConferenceRoomKind | undefined, t: TFunction): string {
  if (kind === 'ephemeral') return t('conferences.kindEphemeral', 'Разовая');
  return t('conferences.kindPermanent', 'Постоянная');
}

export function formatRoomStrictness(
  value: ConferenceEntryStrictness | undefined,
  t: TFunction,
): string {
  if (value === 'token_name_pin_moderator') {
    return t('conferences.strictnessModerator', 'Одобрение модератором');
  }
  if (value === 'token_name_pin') {
    return t('conferences.strictnessPin', 'Ссылка, имя и PIN');
  }
  return t('conferences.strictnessName', 'Ссылка и имя');
}

export function formatRoomRecordMode(mode: ConferenceRecordMode | undefined, t: TFunction): string {
  if (mode === 'auto') return t('conferences.recordAuto', 'Авто');
  if (mode === 'button') return t('conferences.recordButton', 'По кнопке');
  if (mode === 'both') return t('conferences.recordBoth', 'Авто и по кнопке');
  return t('conferences.recordOff', 'Выключена');
}

export const useConferencesTableColumns = (onDelete: (row: ConferenceListRow) => void) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return useMemo(
    () => [
      columnHelper.accessor('number', {
        header: () => t('conferences.number', 'Номер комнаты'),
        cell: (info) => <Text as="span" className={cls.cell}>{info.getValue()}</Text>,
      }),
      columnHelper.accessor('name', {
        header: () => t('conferences.name', 'Название'),
        cell: (info) => {
          const name = info.getValue();
          return (
            <Text as="span" className={cls.name} title={name}>
              {name}
            </Text>
          );
        },
      }),
      columnHelper.accessor((row) => row.kind, {
        id: 'type',
        header: () => t('conferences.kind', 'Тип'),
        cell: (info) => (
          <Badge variant="outline">{formatRoomKind(info.getValue(), t)}</Badge>
        ),
      }),
      columnHelper.accessor((row) => row.entry_strictness, {
        id: 'strictness',
        header: () => t('conferences.strictness', 'Строгость входа'),
        cell: (info) => (
          <Badge variant="secondary">{formatRoomStrictness(info.getValue(), t)}</Badge>
        ),
      }),
      columnHelper.accessor((row) => row.record_mode, {
        id: 'recording',
        header: () => t('conferences.tabRecord', 'Запись'),
        cell: (info) => (
          <Badge variant="outline">{formatRoomRecordMode(info.getValue(), t)}</Badge>
        ),
      }),
      columnHelper.accessor((row) => row.participants?.length ?? 0, {
        id: 'headcount',
        header: () => t('conferences.live.participants', 'Участники'),
        cell: (info) => (
          <Text as="span" className={cls.headcount}>
            {info.getValue()}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => t('common.actions'),
        cell: (info) => {
          const room = info.row.original;
          return (
            <TableRowActions>
              <TableRowAction
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => dispatch(conferencesPageActions.openEditModal(room.uid))}
              >
                <Pencil />
              </TableRowAction>
              <TableRowAction
                title={t('common.copy')}
                aria-label={t('common.copy')}
                onClick={() => dispatch(conferencesPageActions.openCopyModal(room.uid))}
              >
                <Copy />
              </TableRowAction>
              <TableRowAction
                danger
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => onDelete(room)}
              >
                <Trash2 />
              </TableRowAction>
            </TableRowActions>
          );
        },
      }),
    ],
    [t, dispatch, onDelete],
  );
};
