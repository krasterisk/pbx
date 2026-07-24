import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { MessageSquare, X, ChevronLeft, Users, Megaphone } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { selectCurrentUser } from '@/entities/User';
import type { RootState } from '@/app/store/store';
import {
  useGetChatChannelsQuery,
  useGetChatContactsQuery,
  useCreateChatChannelMutation,
  useSendChatMessageMutation,
  type IChatChannel,
} from '@/shared/api/endpoints/callCenterApi';
import { selectCcQueues } from '../../model/selectors/callCenterSelectors';
import { setChatOpen } from '../../model/slice/callCenterSlice';
import { ChatThread } from './ChatThread';
import styles from './ChatPanel.module.scss';

function parseDirectPeer(channelKey: string, myId: number): number | null {
  const m = /^dm:(\d+):(\d+)$/.exec(channelKey);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === myId) return b;
  if (b === myId) return a;
  return null;
}

function parseGroupUid(channelKey: string): number | undefined {
  const m = /^group:(\d+)$/.exec(channelKey);
  return m ? Number(m[1]) : undefined;
}

interface ChatToggleProps {
  onClick: () => void;
  unreadTotal: number;
  active?: boolean;
  /** Show text label next to the icon (header placement). */
  showLabel?: boolean;
}

export function ChatPanelToggle({ onClick, unreadTotal, active, showLabel = false }: ChatToggleProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`${styles.toggleBtn}${showLabel ? ` ${styles.toggleBtnLabeled}` : ''}${active ? ` ${styles.toggleBtnActive}` : ''}`}
      onClick={onClick}
      title={t('callcenter.chat.title')}
      aria-label={t('callcenter.chat.title')}
      aria-expanded={active}
    >
      <MessageSquare className={showLabel ? 'w-5 h-5' : 'w-4 h-4'} />
      {showLabel ? <span className={styles.toggleLabel}>{t('callcenter.chat.title')}</span> : null}
      {unreadTotal > 0 && (
        <span className={styles.toggleBadge}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>
      )}
    </button>
  );
}

interface PanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ open, onClose }: PanelProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const queues = useSelector(selectCcQueues);
  const unreadByChannel = useSelector((s: RootState) => s.callCenter.chatUnreadByChannel);

  const { data: channels = [] } = useGetChatChannelsQuery(undefined, { skip: !open });
  const { data: contacts = [] } = useGetChatContactsQuery(undefined, { skip: !open });
  const [createChannel] = useCreateChatChannelMutation();
  const [sendMessage] = useSendChatMessageMutation();

  const [selected, setSelected] = useState<IChatChannel | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const [showContacts, setShowContacts] = useState(false);

  const canBroadcast = (user?.level ?? 99) >= 3;
  const myId = user?.uniqueid ?? 0;

  const contactNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of contacts) map.set(c.id, c.name);
    return map;
  }, [contacts]);

  const channelLabel = (ch: IChatChannel): string => {
    if (ch.name) return ch.name;
    if (ch.type === 'broadcast_all') return t('callcenter.chat.broadcastAll');
    if (ch.type === 'broadcast_queue') return ch.queue_name || ch.channel_key;
    if (ch.type === 'direct') {
      const peer = parseDirectPeer(ch.channel_key, myId);
      if (peer != null) return contactNameById.get(peer) || `#${peer}`;
    }
    return ch.channel_key;
  };

  const sortedChannels = useMemo(() => {
    const order = { direct: 0, group: 1, broadcast_all: 2, broadcast_queue: 3 };
    return [...channels].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
  }, [channels]);

  const handleOpen = () => {
    dispatch(setChatOpen(true));
  };

  const handleClose = () => {
    dispatch(setChatOpen(false));
    setSelected(null);
    onClose();
  };

  const startDirect = (contactId: number) => {
    const key = `dm:${Math.min(myId, contactId)}:${Math.max(myId, contactId)}`;
    setSelected({ channel_key: key, type: 'direct' });
    setShowContacts(false);
    handleOpen();
  };

  const submitNewGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0) return;
    try {
      const created = await createChannel({ name: groupName.trim(), memberUserIds: groupMembers }).unwrap();
      setShowNewGroup(false);
      setGroupName('');
      setGroupMembers([]);
      setSelected({
        channel_key: created.channel_key,
        type: 'group',
        name: created.name,
        member_user_ids: created.member_user_ids,
      });
    } catch { /* ignore */ }
  };

  const sendBroadcast = async (type: 'broadcast_all' | 'broadcast_queue', queue?: string) => {
    const body = window.prompt(t('callcenter.chat.placeholder'));
    if (!body?.trim()) return;
    try {
      await sendMessage({ channelType: type, body: body.trim(), queue }).unwrap();
      if (type === 'broadcast_all') {
        setSelected({ channel_key: 'broadcast:all', type: 'broadcast_all' });
      } else if (queue) {
        setSelected({ channel_key: `broadcast:queue:${queue}`, type: 'broadcast_queue', queue_name: queue });
      }
    } catch { /* ignore */ }
  };

  if (!open) return null;

  const selectedTarget = selected?.type === 'direct'
    ? parseDirectPeer(selected.channel_key, myId) ?? undefined
    : undefined;
  const selectedGroupUid = selected ? parseGroupUid(selected.channel_key) : undefined;

  return (
    <aside className={styles.panel} aria-label={t('callcenter.chat.title')}>
      <div className={styles.header}>
        <Text className={styles.title}>{t('callcenter.chat.title')}</Text>
        <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label={t('common.close', 'Close')}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={styles.body}>
        {selected ? (
          <>
            <div className={styles.backRow}>
              <button type="button" className={styles.backBtn} onClick={() => setSelected(null)}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Text className="text-sm font-medium truncate">{channelLabel(selected)}</Text>
            </div>
            <ChatThread
              channel={selected}
              targetUserId={selectedTarget}
              groupUid={selectedGroupUid}
            />
          </>
        ) : (
          <>
            <div className={styles.list}>
              {sortedChannels.map(ch => (
                <button
                  key={ch.channel_key}
                  type="button"
                  className={styles.channelRow}
                  onClick={() => { setSelected(ch); handleOpen(); }}
                >
                  {ch.type === 'group' && <Users className="w-4 h-4 shrink-0" />}
                  {(ch.type === 'broadcast_all' || ch.type === 'broadcast_queue') && (
                    <Megaphone className="w-4 h-4 shrink-0" />
                  )}
                  <span className={styles.channelName}>{channelLabel(ch)}</span>
                  {(unreadByChannel[ch.channel_key] ?? 0) > 0 && (
                    <span className={styles.unreadBadge}>{unreadByChannel[ch.channel_key]}</span>
                  )}
                </button>
              ))}

              {showContacts && (
                <div className={styles.contactPick}>
                  {contacts.filter(c => c.id !== myId).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={styles.channelRow}
                      onClick={() => startDirect(c.id)}
                    >
                      <span className={styles.channelName}>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.toolbar}>
              <Button size="sm" variant="outline" onClick={() => setShowContacts(v => !v)}>
                {t('callcenter.chat.newDm', 'Direct message')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewGroup(v => !v)}>
                {t('callcenter.chat.newGroup')}
              </Button>

              {canBroadcast && (
                <div className={styles.broadcastRow}>
                  <button
                    type="button"
                    className={styles.broadcastBtn}
                    onClick={() => void sendBroadcast('broadcast_all')}
                  >
                    {t('callcenter.chat.broadcastAll')}
                  </button>
                  {queues.slice(0, 3).map(q => (
                    <button
                      key={q.name}
                      type="button"
                      className={styles.broadcastBtn}
                      onClick={() => void sendBroadcast('broadcast_queue', q.name)}
                    >
                      {t('callcenter.chat.broadcastQueue', { queue: q.displayName || q.name })}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showNewGroup && (
              <div className={styles.newGroupForm}>
                <input
                  className={styles.input}
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder={t('callcenter.chat.newGroup')}
                />
                <div className={styles.contactPick}>
                  {contacts.filter(c => c.id !== myId).map(c => (
                    <label key={c.id} className={styles.contactLabel}>
                      <input
                        type="checkbox"
                        checked={groupMembers.includes(c.id)}
                        onChange={e => {
                          setGroupMembers(prev =>
                            e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id),
                          );
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={() => void submitNewGroup()} disabled={!groupName.trim()}>
                  {t('callcenter.chat.createGroup', 'Create')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/** Header toggle + panel wrapper for agent/supervisor pages */
export function ChatPanelHost({ showLabel = false }: { showLabel?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const unreadByChannel = useSelector((s: RootState) => s.callCenter.chatUnreadByChannel);
  const unreadTotal = Object.values(unreadByChannel).reduce((s, n) => s + n, 0);

  return (
    <>
      <ChatPanelToggle
        onClick={() => setOpen(v => !v)}
        unreadTotal={unreadTotal}
        active={open}
        showLabel={showLabel}
      />
      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
