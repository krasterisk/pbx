import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input, Select, Text, Label, InfoTooltip, Tooltip } from '@/shared/ui';
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

function restrictToVerticalAxisLocal({
  transform,
}: {
  transform: { x: number; y: number; scaleX: number; scaleY: number };
}) {
  return { ...transform, x: 0 };
}

function buildMemberDndAnnouncements(
  t: (key: string, fallback?: string) => string,
  lang: string,
  getIndex?: (id: string | number) => number,
): Announcements {
  const isEn = lang.toLowerCase().startsWith('en');
  const positionOf = (id?: string | number) => {
    if (id == null) return 1;
    return (getIndex?.(id) ?? 0) + 1;
  };

  return {
    onDragStart: () =>
      isEn
        ? t('callGroups.dnd.picked', 'Member picked')
        : t('callGroups.dnd.picked', 'Участник поднят'),
    onDragOver: ({ over }) => {
      const n = positionOf(over?.id);
      return isEn
        ? t('callGroups.dnd.moved', 'Moved to position {{n}}').replace('{{n}}', String(n))
        : t('callGroups.dnd.moved', 'Перемещён на позицию {{n}}').replace('{{n}}', String(n));
    },
    onDragEnd: ({ over }) =>
      over
        ? isEn
          ? t('callGroups.dnd.dropped', 'Member dropped')
          : t('callGroups.dnd.dropped', 'Участник отпущен')
        : undefined,
    onDragCancel: () =>
      isEn
        ? t('callGroups.dnd.cancelled', 'Move cancelled')
        : t('callGroups.dnd.cancelled', 'Перемещение отменено'),
  };
}

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

function SortableMemberRow({
  member,
  index,
  showMemberRingTime,
  endpoints,
  endpointsLoading,
  onUpdate,
  onRemove,
}: {
  member: LocalCallGroupMember;
  index: number;
  showMemberRingTime: boolean;
  endpoints: { id: string; extension: string; callerid?: string }[];
  endpointsLoading: boolean;
  onUpdate: (index: number, patch: Partial<LocalCallGroupMember>) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const sortable = useSortable({ id: member.id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.6 : 1,
  };

  return (
    <Flex
      ref={sortable.setNodeRef}
      style={style}
      align="center"
      wrap="wrap"
      gap="8"
      className={cls.memberItem}
    >
      <Tooltip content={t('routes.tooltips.dragHandle', 'Перетащите для изменения порядка')}>
        <button
          type="button"
          className={cls.dragHandle}
          aria-label={t('routes.tooltips.dragHandle', 'Перетащите для изменения порядка')}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical size={18} />
        </button>
      </Tooltip>

      <Text as="span" className={cls.memberIndex}>{index + 1}</Text>

      <Select
        className={cls.typeSelect}
        value={member.member_type}
        onChange={(e) => onUpdate(index, { member_type: e.target.value as CallGroupMemberType })}
      >
        <option value="internal">{t('callGroups.memberTypeInternal', 'Внутренний')}</option>
        <option value="external">{t('callGroups.memberTypeExternal', 'Внешний')}</option>
      </Select>

      <MemberValueField
        memberType={member.member_type}
        value={member.value}
        onChange={(value) => onUpdate(index, { value })}
        endpoints={endpoints}
        endpointsLoading={endpointsLoading}
      />

      {showMemberRingTime && (
        <Input
          className={cls.ringTimeInput}
          type="number"
          min={0}
          value={member.ring_time}
          onChange={(e) => onUpdate(index, { ring_time: e.target.value })}
          placeholder={t('callGroups.ringTimeMember', 'Сек.')}
          title={t('callGroups.ringTimeMemberDesc')}
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        title={t('common.delete', 'Удалить')}
      >
        <Trash2 size={16} />
      </Button>
    </Flex>
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
  const { t, i18n } = useTranslation();
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const announcements = useMemo(
    () =>
      buildMemberDndAnnouncements(t, i18n?.language ?? 'ru', (id) =>
        members.findIndex((item) => item.id === Number(id)),
      ),
    [i18n?.language, members, t],
  );

  useEffect(() => {
    setDraftValue('');
  }, [draftType]);

  const handleAdd = useCallback(() => {
    if (!draftValue.trim()) return;
    setMembers([
      ...members,
      {
        id: Date.now(),
        member_type: draftType,
        value: draftValue.trim(),
        ring_time: draftRingTime,
      },
    ]);
    setDraftValue('');
    setDraftRingTime('');
  }, [draftType, draftValue, draftRingTime, members, setMembers]);

  const handleRemove = useCallback((index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  }, [members, setMembers]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = members.findIndex((item) => item.id === active.id);
    const to = members.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    setMembers(arrayMove(members, from, to));
  }, [members, setMembers]);

  const handleUpdate = useCallback((index: number, patch: Partial<LocalCallGroupMember>) => {
    setMembers(members.map((m, i) => {
      if (i !== index) return m;
      const next = { ...m, ...patch };
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

      <Flex align="center" wrap="wrap" gap="8" className={cls.addRow}>
        <Select
          className={cls.addTypeSelect}
          value={draftType}
          onChange={(e) => setDraftType(e.target.value as CallGroupMemberType)}
          aria-label={t('callGroups.memberType', 'Тип участника')}
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxisLocal]}
            accessibility={{ announcements }}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={members.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <VStack gap="8" max role="list">
                {members.map((member, index) => (
                  <SortableMemberRow
                    key={member.id}
                    member={member}
                    index={index}
                    showMemberRingTime={showMemberRingTime}
                    endpoints={endpointOptions}
                    endpointsLoading={endpointsLoading}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                  />
                ))}
              </VStack>
            </SortableContext>
          </DndContext>
        )}
      </VStack>
    </VStack>
  );
});

CallGroupMembersEditor.displayName = 'CallGroupMembersEditor';
