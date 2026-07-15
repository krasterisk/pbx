import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { Button, Input, Select, Text } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import type { CallGroupMemberType } from '@krasterisk/shared';
import cls from './CallGroupMembersEditor.module.scss';

export interface LocalCallGroupMember {
  id: number;
  member_type: CallGroupMemberType;
  value: string;
  ring_time: string;
}

export interface CallGroupMembersEditorProps {
  members: LocalCallGroupMember[];
  setMembers: (members: LocalCallGroupMember[]) => void;
}

const withPositions = (list: LocalCallGroupMember[]): LocalCallGroupMember[] => list;

export const CallGroupMembersEditor = memo(({ members, setMembers }: CallGroupMembersEditorProps) => {
  const { t } = useTranslation();
  const [draftType, setDraftType] = useState<CallGroupMemberType>('internal');
  const [draftValue, setDraftValue] = useState('');
  const [draftRingTime, setDraftRingTime] = useState('');

  const handleAdd = useCallback(() => {
    if (!draftValue.trim()) return;
    setMembers(withPositions([
      ...members,
      {
        id: Date.now(),
        member_type: draftType,
        value: draftValue.trim(),
        ring_time: draftRingTime,
      },
    ]));
    setDraftValue('');
    setDraftRingTime('');
  }, [draftType, draftValue, draftRingTime, members, setMembers]);

  const handleRemove = useCallback((index: number) => {
    setMembers(withPositions(members.filter((_, i) => i !== index)));
  }, [members, setMembers]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const copy = [...members];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    setMembers(withPositions(copy));
  }, [members, setMembers]);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= members.length - 1) return;
    const copy = [...members];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    setMembers(withPositions(copy));
  }, [members, setMembers]);

  const handleUpdate = useCallback((index: number, patch: Partial<LocalCallGroupMember>) => {
    setMembers(members.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }, [members, setMembers]);

  return (
    <VStack gap="12" max className={cls.wrapper}>
      <Text variant="small">{t('callGroups.members', 'Участники')}</Text>

      <VStack gap="8" max className={cls.membersBox}>
        {members.length === 0 ? (
          <VStack align="center" className={cls.emptyState}>
            <Text variant="small" className={cls.emptyText}>
              {t('callGroups.noMembers', 'Добавьте хотя бы одного участника')}
            </Text>
          </VStack>
        ) : (
          <VStack gap="8" max>
            {members.map((member, index) => (
              <Flex key={member.id} align="center" wrap="wrap" gap="8" className={cls.memberItem}>
                <Text as="span" className={cls.memberIndex}>{index + 1}</Text>

                <Select
                  className={cls.typeSelect}
                  value={member.member_type}
                  onChange={(e) => handleUpdate(index, { member_type: e.target.value as CallGroupMemberType })}
                >
                  <option value="internal">{t('callGroups.memberTypeInternal', 'Внутренний')}</option>
                  <option value="external">{t('callGroups.memberTypeExternal', 'Внешний')}</option>
                </Select>

                <Input
                  className={cls.valueInput}
                  value={member.value}
                  onChange={(e) => handleUpdate(index, { value: e.target.value })}
                  placeholder={t('callGroups.memberValue', 'Номер / добавочный')}
                />

                <Input
                  className={cls.ringTimeInput}
                  type="number"
                  min={0}
                  value={member.ring_time}
                  onChange={(e) => handleUpdate(index, { ring_time: e.target.value })}
                  placeholder={t('callGroups.ringTime', 'Время звонка (сек)')}
                />

                <HStack gap="4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    title={t('common.moveUp', 'Вверх')}
                  >
                    <ChevronUp size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveDown(index)}
                    disabled={index >= members.length - 1}
                    title={t('common.moveDown', 'Вниз')}
                  >
                    <ChevronDown size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    title={t('common.delete', 'Удалить')}
                  >
                    <Trash2 size={16} />
                  </Button>
                </HStack>
              </Flex>
            ))}
          </VStack>
        )}
      </VStack>

      <Flex align="center" wrap="wrap" gap="8" className={cls.addRow}>
        <Select
          className={cls.addTypeSelect}
          value={draftType}
          onChange={(e) => setDraftType(e.target.value as CallGroupMemberType)}
        >
          <option value="internal">{t('callGroups.memberTypeInternal', 'Внутренний')}</option>
          <option value="external">{t('callGroups.memberTypeExternal', 'Внешний')}</option>
        </Select>

        <Input
          className={cls.addValueInput}
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          placeholder={t('callGroups.memberValue', 'Номер / добавочный')}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />

        <Input
          className={cls.addRingTimeInput}
          type="number"
          min={0}
          value={draftRingTime}
          onChange={(e) => setDraftRingTime(e.target.value)}
          placeholder={t('callGroups.ringTime', 'Время звонка (сек)')}
        />

        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!draftValue.trim()}>
          <Plus size={14} />
          {t('callGroups.addMember', 'Добавить участника')}
        </Button>
      </Flex>
    </VStack>
  );
});

CallGroupMembersEditor.displayName = 'CallGroupMembersEditor';
