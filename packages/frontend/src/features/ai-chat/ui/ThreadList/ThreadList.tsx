import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    TableRowAction,
    TableRowActions,
    Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
    useCreateAiChatThreadMutation,
    useDeleteAiChatThreadMutation,
    useGetAiChatThreadsQuery,
    type IAiChatThread,
} from '@/shared/api/endpoints/aiChatApi';
import cls from './ThreadList.module.scss';

export interface ThreadListProps {
    selectedUid: number | null;
    onSelect: (uid: number) => void;
    onDeleted?: (uid: number) => void;
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

export const ThreadList = ({ selectedUid, onSelect, onDeleted }: ThreadListProps) => {
    const { t } = useTranslation();
    const { data, isLoading, isError, refetch } = useGetAiChatThreadsQuery();
    const [createThread] = useCreateAiChatThreadMutation();
    const [deleteThread] = useDeleteAiChatThreadMutation();
    const [pendingDeleteUid, setPendingDeleteUid] = useState<number | null>(null);

    const threads = useMemo(
        () => [...(data ?? [])].sort((a, b) => threadTime(b) - threadTime(a)),
        [data],
    );

    const handleCreate = async () => {
        const created = await createThread().unwrap();
        onSelect(created.uid);
    };

    const handleConfirmDelete = async () => {
        if (pendingDeleteUid == null) return;
        const uid = pendingDeleteUid;
        await deleteThread(uid).unwrap();
        setPendingDeleteUid(null);
        onDeleted?.(uid);
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

            {isLoading && (
                <VStack gap="8" align="stretch" aria-busy aria-label={t('aiChat.loadingThreads')}>
                    {[0, 1, 2].map((index) => (
                        <VStack key={index} data-testid="ai-agent-thread-skeleton" align="stretch">
                            <Skeleton className={cls.skeleton} height={48} />
                        </VStack>
                    ))}
                </VStack>
            )}

            {!isLoading && isError && (
                <VStack className={cls.state} gap="8" align="stretch">
                    <Text variant="muted">{t('aiChat.errorThreads')}</Text>
                    <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                        {t('aiChat.retry')}
                    </Button>
                </VStack>
            )}

            {!isLoading && !isError && threads.length === 0 && (
                <VStack className={cls.state} gap="8" align="stretch">
                    <Text as="span" className={cls.emptyTitle}>{t('aiChat.emptyTitle')}</Text>
                    <Text variant="muted">{t('aiChat.emptyBody')}</Text>
                </VStack>
            )}

            {!isLoading && !isError && threads.length > 0 && (
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
                            <HStack
                                key={thread.uid}
                                role="option"
                                aria-selected={selected}
                                tabIndex={0}
                                className={`${cls.row} ${selected ? cls.selected : ''}`}
                                align="center"
                                gap="8"
                                onClick={() => onSelect(thread.uid)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(thread.uid);
                                    }
                                }}
                            >
                                <VStack gap="0" align="start" max>
                                    <Text as="span" className={cls.title}>{title}</Text>
                                    <Text as="span" className={cls.time}>
                                        {formatRelativeTime(thread.last_message_at, t)}
                                    </Text>
                                </VStack>
                                <TableRowActions>
                                    <TableRowAction
                                        danger
                                        title={t('aiChat.deleteConversation')}
                                        aria-label={t('aiChat.deleteConversation')}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPendingDeleteUid(thread.uid);
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </TableRowAction>
                                </TableRowActions>
                            </HStack>
                        );
                    })}
                </VStack>
            )}

            <Dialog
                open={pendingDeleteUid != null}
                onOpenChange={(open) => {
                    if (!open) setPendingDeleteUid(null);
                }}
            >
                <DialogContent data-testid="ai-agent-delete-dialog">
                    <DialogHeader>
                        <DialogTitle>{t('aiChat.deleteConfirmTitle')}</DialogTitle>
                        <DialogDescription>{t('aiChat.deleteConfirmBody')}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPendingDeleteUid(null)}
                        >
                            {t('aiChat.keepConversation')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => void handleConfirmDelete()}
                        >
                            {t('aiChat.deleteConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </VStack>
    );
};
