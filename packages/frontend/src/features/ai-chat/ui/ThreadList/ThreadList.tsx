import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
    useCreateAiChatThreadMutation,
    useGetAiChatThreadsQuery,
    type IAiChatThread,
} from '@/shared/api/endpoints/aiChatApi';
import cls from './ThreadList.module.scss';

export interface ThreadListProps {
    selectedUid: number | null;
    onSelect: (uid: number) => void;
}

function threadTime(thread: IAiChatThread): number {
    const raw = thread.last_message_at ?? thread.created_at;
    const ms = raw ? new Date(raw).getTime() : 0;
    return Number.isNaN(ms) ? 0 : ms;
}

export function formatRelativeTime(
    iso: string | null,
    t: (key: string, options?: { count: number }) => string,
    now = Date.now(),
): string {
    if (!iso) return t('aiChat.relative.justNow');
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return t('aiChat.relative.justNow');
    const minutes = Math.max(0, Math.floor((now - then) / 60_000));
    if (minutes < 1) return t('aiChat.relative.justNow');
    if (minutes < 60) return t('aiChat.relative.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('aiChat.relative.hours', { count: hours });
    return t('aiChat.relative.days', { count: Math.floor(hours / 24) });
}

export const ThreadList = ({ selectedUid, onSelect }: ThreadListProps) => {
    const { t } = useTranslation();
    const { data } = useGetAiChatThreadsQuery();
    const [createThread] = useCreateAiChatThreadMutation();

    const threads = useMemo(
        () => [...(data ?? [])].sort((a, b) => threadTime(b) - threadTime(a)),
        [data],
    );

    const handleCreate = async () => {
        const created = await createThread().unwrap();
        onSelect(created.uid);
    };

    return (
        <VStack className={cls.root} gap="8" align="stretch" data-testid="ai-agent-thread-list">
            <HStack justify="between" align="center" gap="8">
                <Text as="span" className={cls.heading}>{t('aiChat.threadsHeading')}</Text>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCreate()}
                    aria-label={t('aiChat.newConversation')}
                >
                    <Plus size={14} aria-hidden />
                    {t('aiChat.newConversation')}
                </Button>
            </HStack>

            <VStack
                className={cls.list}
                gap="4"
                align="stretch"
                role="listbox"
                aria-label={t('aiChat.threadsHeading')}
            >
                {threads.map((thread) => {
                    const selected = thread.uid === selectedUid;
                    const title = thread.title.trim() || t('aiChat.untitled');
                    return (
                        <Button
                            key={thread.uid}
                            type="button"
                            variant="ghost"
                            role="option"
                            aria-selected={selected}
                            className={`${cls.row} ${selected ? cls.selected : ''}`}
                            onClick={() => onSelect(thread.uid)}
                        >
                            <VStack gap="0" align="start" max>
                                <Text as="span" className={cls.title}>{title}</Text>
                                <Text as="span" className={cls.time}>
                                    {formatRelativeTime(thread.last_message_at, t)}
                                </Text>
                            </VStack>
                        </Button>
                    );
                })}
            </VStack>
        </VStack>
    );
};
