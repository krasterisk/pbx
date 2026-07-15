import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { selectCurrentUser } from '@/entities/User';
import {
  useGetChatMessagesQuery,
  useSendChatMessageMutation,
  type IChatMessage,
  type IChatChannel,
} from '@/shared/api/endpoints/callCenterApi';
import { markChannelRead } from '../../model/slice/callCenterSlice';
import styles from './ChatThread.module.scss';

interface Props {
  channel: IChatChannel;
  targetUserId?: number;
  groupUid?: number;
}

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export function ChatThread({ channel, targetUserId, groupUid }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const [draft, setDraft] = useState('');
  const [liveMessages, setLiveMessages] = useState<IChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: history = [], isLoading } = useGetChatMessagesQuery({ channelKey: channel.channel_key });
  const [sendMessage, { isLoading: sending }] = useSendChatMessageMutation();

  useEffect(() => {
    dispatch(markChannelRead(channel.channel_key));
    setLiveMessages([]);
  }, [channel.channel_key, dispatch]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<IChatMessage>).detail;
      if (detail?.channel_key !== channel.channel_key) return;
      setLiveMessages(prev => {
        if (prev.some(m => m.uid === detail.uid)) return prev;
        return [...prev, detail];
      });
      dispatch(markChannelRead(channel.channel_key));
    };
    window.addEventListener('cc:chat-message', handler);
    return () => window.removeEventListener('cc:chat-message', handler);
  }, [channel.channel_key, dispatch]);

  const merged = useCallback(() => {
    const map = new Map<number, IChatMessage>();
    for (const m of history) map.set(m.uid, m);
    for (const m of liveMessages) map.set(m.uid, m);
    return [...map.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [history, liveMessages]);

  const messages = merged();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await sendMessage({
        channelType: channel.type,
        body,
        targetUserId,
        groupUid,
        queue: channel.queue_name,
      }).unwrap();
      setDraft('');
    } catch { /* toast handled by RTK */ }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isBroadcast = channel.type === 'broadcast_all' || channel.type === 'broadcast_queue';
  const myId = user?.uniqueid;

  return (
    <div className={styles.thread}>
      <div className={styles.messages}>
        {isLoading && messages.length === 0 ? (
          <Text variant="muted" className="text-sm text-center py-8">{t('callcenter.connecting')}</Text>
        ) : messages.length === 0 ? (
          <div className={styles.empty}>
            <Text className={styles.emptyTitle}>{t('callcenter.chat.empty.title')}</Text>
            <Text className={styles.emptyBody}>{t('callcenter.chat.empty.body')}</Text>
          </div>
        ) : (
          messages.map(msg => {
            const own = myId != null && msg.sender_user_id === myId;
            const broadcast = msg.channel_type === 'broadcast_all' || msg.channel_type === 'broadcast_queue';
            return (
              <div
                key={msg.uid}
                className={`${styles.bubbleRow} ${own ? styles.bubbleRowOwn : styles.bubbleRowOther}`}
              >
                {!own && !broadcast && msg.sender_name && (
                  <span className={styles.senderName}>{msg.sender_name}</span>
                )}
                <div
                  className={`${styles.bubble} ${
                    broadcast ? styles.bubbleBroadcast : own ? styles.bubbleOwn : styles.bubbleOther
                  }`}
                >
                  {broadcast && <Megaphone className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{msg.body}</span>
                </div>
                <span className={styles.meta}>{fmtTime(msg.created_at)}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.textarea}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('callcenter.chat.placeholder')}
          disabled={sending}
        />
        <Button
          className={styles.sendBtn}
          size="sm"
          onClick={() => void handleSend()}
          disabled={sending || !draft.trim()}
        >
          {t('callcenter.chat.send')}
        </Button>
      </div>
    </div>
  );
}
