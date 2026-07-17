import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { Button, Input, Select, Text, Label, InfoTooltip } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import type { CallGroupMemberType, RingStrategy } from '@krasterisk/shared';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';
import cls from './CallGroupMembersEditor.module.scss';

export interface LocalCallGroupMember {
  id: number;
  member_type: CallGroupMemberType;
  value: string;
  ring_time: string;
}

export interface CallGroupContextOption {
  uid: number;
  name: string;
}

export interface CallGroupMembersEditorProps {
  members: LocalCallGroupMember[];
  setMembers: (members: LocalCallGroupMember[]) => void;
  strategy: RingStrategy;
  externalContext: string;
  onExternalContextChange: (value: string) => void;
  contexts: CallGroupContextOption[];
}

/** Per-member ring_time is used by hunt, memoryhunt, and the first step of random. */
function usesMemberRingTime(strategy: RingStrategy): boolean {
  return strategy === 'hunt' || strategy === 'memoryhunt' || strategy === 'random';
}

const withPositions = (list: LocalCallGroupMember[]): LocalCallGroupMember[] => list;

function MemberValueField({
  memberType,
  value,
  onChange,
  endpoints,
  endpointsLoading,
}: {
  memberType: CallGroupMemberType;
  value: string;
  onChange: (value: string) => void;
  endpoints: { id: string; extension: string; callerid?: string }[];
  endpointsLoading: boolean;
}) {
  const { t } = useTranslation();

  if (memberType === 'internal') {
    const known = endpoints.some((ep) => ep.extension === value);
    return (
      <Select
        className={cls.valueInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={endpointsLoading}
      >
        <option value="" disabled>
          {t('callGroups.selectEndpoint', 'Выберите абонента')}
        </option>
        {!known && value ? (
          <option value={value}>
            {value} ({t('callGroups.endpointMissing', 'нет в списке')})
          </option>
        ) : null}
        {endpoints.map((ep) => (
          <option key={ep.id} value={ep.extension}>
            {ep.extension}
            {ep.callerid ? ` (${ep.callerid})` : ''}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Input
      className={cls.valueInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('callGroups.memberValueExternal', 'Внешний номер')}
    />
  );
}

export const CallGroupMembersEditor = memo(({
  members,
  setMembers,
  strategy,
  externalContext,
  onExternalContextChange,
  contexts,
}: CallGroupMembersEditorProps) => {
  const { t } = useTranslation();
  const { data: endpoints = [], isLoading: endpointsLoading } = useGetEndpointsQuery();
  const [draftType, setDraftType] = useState<CallGroupMemberType>('internal');
  const [draftValue, setDraftValue] = useState('');
  const [draftRingTime, setDraftRingTime] = useState('');
  const showMemberRingTime = usesMemberRingTime(strategy);

  const needsExternalContext =
    draftType === 'external' || members.some((m) => m.member_type === 'external');

  const hasContexts = contexts.length > 0;

  const endpointOptions = useMemo(
    () =>
      endpoints.map((ep) => ({
        id: ep.id,
        extension: ep.extension,
        callerid: ep.callerid,
      })),
    [endpoints],
  );

  // Reset draft value when switching type (internal select vs external input)
  useEffect(() => {
    setDraftValue('');
  }, [draftType]);

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
    setMembers(members.map((m, i) => {
      if (i !== index) return m;
      const next = { ...m, ...patch };
      // Clear value when switching member type — formats differ
      if (patch.member_type && patch.member_type !== m.member_type) {
        next.value = '';
      }
      return next;
    }));
  }, [members, setMembers]);

  return (
    <VStack gap="12" max className={cls.wrapper}>
      <HStack gap="4" align="center">
        <Text variant="small">{t('callGroups.members', 'Участники')}</Text>
        <InfoTooltip text={t('callGroups.membersDesc')} />
      </HStack>

      {needsExternalContext && (
        <div className={cls.externalContextField}>
          <HStack gap="4" align="center">
            <Label htmlFor="call-group-external-context">
              {t('callGroups.externalContext', 'Контекст для внешних')}
            </Label>
            <InfoTooltip text={t('callGroups.externalContextDesc')} />
          </HStack>
          {hasContexts ? (
            <Select
              id="call-group-external-context"
              value={externalContext}
              onChange={(e) => onExternalContextChange(e.target.value)}
            >
              {contexts.map((ctx) => (
                <option key={ctx.uid} value={ctx.name}>
                  {ctx.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="call-group-external-context"
              value={externalContext}
              onChange={(e) => onExternalContextChange(e.target.value)}
              required
            />
          )}
        </div>
      )}

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

                <MemberValueField
                  memberType={member.member_type}
                  value={member.value}
                  onChange={(value) => handleUpdate(index, { value })}
                  endpoints={endpointOptions}
                  endpointsLoading={endpointsLoading}
                />

                {showMemberRingTime && (
                  <Input
                    className={cls.ringTimeInput}
                    type="number"
                    min={0}
                    value={member.ring_time}
                    onChange={(e) => handleUpdate(index, { ring_time: e.target.value })}
                    placeholder={t('callGroups.ringTimeMember', 'Сек.')}
                    title={t('callGroups.ringTimeMemberDesc')}
                  />
                )}

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

        <MemberValueField
          memberType={draftType}
          value={draftValue}
          onChange={setDraftValue}
          endpoints={endpointOptions}
          endpointsLoading={endpointsLoading}
        />

        {showMemberRingTime && (
          <Input
            className={cls.addRingTimeInput}
            type="number"
            min={0}
            value={draftRingTime}
            onChange={(e) => setDraftRingTime(e.target.value)}
            placeholder={t('callGroups.ringTimeMember', 'Сек.')}
            title={t('callGroups.ringTimeMemberDesc')}
          />
        )}

        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!draftValue.trim()}>
          <Plus size={14} />
          {t('callGroups.addMember', 'Добавить участника')}
        </Button>
      </Flex>
    </VStack>
  );
});

CallGroupMembersEditor.displayName = 'CallGroupMembersEditor';
