import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, Textarea } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useCreateAiChatThreadMutation, useGetHelpdeskSessionQuery, useSendHelpdeskMessageMutation, type IHelpdeskMessage } from '@/shared/api/endpoints/aiChatApi';
import cls from './HelpdeskChat.module.scss';

interface Props { threadUid: number | null; active: boolean; onThreadCreated: (uid: number) => void }

function requestUuid(): string {
    // getRandomValues also works on a LAN HTTP test stand; randomUUID requires HTTPS.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export const HelpdeskChat = ({ threadUid, active, onThreadCreated }: Props) => {
    const { t } = useTranslation();
    const [createThread, creation] = useCreateAiChatThreadMutation();
    const creating = useRef(false);
    const [createError, setCreateError] = useState(false);
    const [draft, setDraft] = useState('');
    const [pending, setPending] = useState<IHelpdeskMessage | null>(null);
    const [pollingInterval, setPollingInterval] = useState(0);
    const [sendError, setSendError] = useState(false);
    const [send, sending] = useSendHelpdeskMessageMutation();
    const session = useGetHelpdeskSessionQuery(threadUid ?? 0, { skip: !active || threadUid == null, pollingInterval, skipPollingIfUnfocused: true });
    const data = session.currentData;
    const task = data?.task;
    const busy = task?.status === 'queued' || task?.status === 'running';
    useEffect(() => { setPollingInterval(busy ? 2500 : 0); }, [busy]);
    const historyRef = useRef<HTMLDivElement>(null);
    useEffect(() => { historyRef.current?.scrollTo?.({ top: historyRef.current.scrollHeight }); }, [data?.history.length, task?.version]);
    useEffect(() => {
        if (threadUid != null || creating.current || createError || !active) return;
        creating.current = true;
        void createThread().unwrap().then((thread) => onThreadCreated(thread.uid)).catch(() => setCreateError(true)).finally(() => { creating.current = false; });
    }, [active, threadUid, createThread, onThreadCreated, createError]);

    const submit = async () => {
        if (!threadUid || !data || sending.isLoading || busy || (!pending && !draft.trim())) return;
        const payload = pending ?? { threadUid, requestId: requestUuid(), message: draft.trim(), expectedTaskId: task?.task_id ?? null, expectedVersion: task?.version ?? null };
        setPending(payload); setSendError(false);
        try {
            await send(payload).unwrap();
            setPending(null); setDraft('');
            void session.refetch();
        } catch (error) {
            setSendError(true);
            if ((error as { status?: number }).status === 409) { setPending(null); void session.refetch(); }
        }
    };
    return (
        <VStack className={cls.root} align="stretch" gap="8" data-testid="helpdesk-chat">
            <Text variant="muted">{t('helpdeskChat.intro')}</Text>
            {task && <Text role="status">{t('helpdeskChat.ticket', { id: task.ticket_id })} · {t(`helpdeskChat.status.${task.status}`)}</Text>}
            <Flex direction="column" ref={historyRef} className={cls.history} align="stretch" gap="12" aria-live="polite">
                {data?.history.map((row) => <VStack key={row.id} className={row.role === 'user' ? cls.user : cls.support} align="stretch" gap="4">
                    <Text variant="xs">{t(`helpdeskChat.role.${row.role}`)}</Text>
                    <Text className={cls.message}>{row.text}</Text>
                </VStack>)}
                {!data?.history.length && !session.isFetching && !session.isError && <Text>{t('helpdeskChat.empty')}</Text>}
                {task?.status === 'escalated' && <Text>{t('helpdeskChat.escalated')}</Text>}
                {task?.status === 'failed' && <Text variant="error">{t('helpdeskChat.failed')}</Text>}
            </Flex>
            {(session.isError || createError) && <HStack gap="8" wrap="wrap">
                <Text role="alert" variant="error">{t('helpdeskChat.unavailable')}</Text>
                <Button variant="outline" onClick={() => { if (createError) setCreateError(false); else void session.refetch(); }}>{t('helpdeskChat.refresh')}</Button>
            </HStack>}
            {sendError && <Text role="alert" variant="error">{t(pending ? 'helpdeskChat.retryHint' : 'helpdeskChat.staleHint')}</Text>}
            <Textarea aria-label={t('helpdeskChat.message')} value={draft} maxLength={8000}
                placeholder={t(task?.status === 'needs_input' ? 'helpdeskChat.answer' : 'helpdeskChat.message')}
                disabled={sending.isLoading || !!pending || busy || !data || session.isError}
                onChange={(event) => setDraft(event.target.value)} />
            <HStack justify="end" gap="8">
                <Button onClick={() => { void submit(); }} disabled={sending.isLoading || busy || !data || session.isError || (!pending && !draft.trim())}>
                    {t(sending.isLoading || creation.isLoading ? 'helpdeskChat.sending' : pending ? 'helpdeskChat.retry' : 'helpdeskChat.send')}
                </Button>
            </HStack>
        </VStack>
    );
};
