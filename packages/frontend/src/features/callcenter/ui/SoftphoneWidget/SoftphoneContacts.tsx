import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Search, Users, List, UsersRound, Plus, Pencil, Trash2, BookUser, Phone,
} from 'lucide-react';
import { Input, Text, Button, Tooltip } from '@/shared/ui';
import {
  useGetTransferDirectoryQuery,
  useGetOperatorCallHistoryQuery,
  useGetMyContactsQuery,
  useClickToCallMutation,
  type IDirectoryEndpoint,
  type IDirectoryQueue,
  type IDirectoryGroup,
  type ICcContact,
  type IOperatorHistoryRow,
} from '@/shared/api/endpoints/callCenterApi';
import { UserLevel, selectCurrentUser, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { requestOutboundDial } from '@/features/callcenter/model/slice/callCenterSlice';
import { isEndpointUnreachable } from '@/features/callcenter/ui/TransferDirectory/TransferDirectory';
import {
  ContactBookForm,
  canManageContact,
} from '@/features/callcenter/ui/ContactBookForm';
import styles from './SoftphoneContacts.module.scss';

const RECENT_LIMIT = 8;

export interface RecentContact {
  number: string;
  label: string;
}

/** Client-side dedup-by-number slice of operator history (most-recent-first). */
export function buildRecentContacts(
  rows: IOperatorHistoryRow[],
  limit = RECENT_LIMIT,
): RecentContact[] {
  const seen = new Set<string>();
  const out: RecentContact[] = [];
  for (const row of rows) {
    const number = (row.callerIdNum || '').trim();
    if (!number || seen.has(number)) continue;
    seen.add(number);
    out.push({
      number,
      label: (row.callerIdName || '').trim() || number,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function presenceDotClass(presence: string | undefined): string {
  const state = (presence || '').toUpperCase();
  if (isEndpointUnreachable(state)) return styles.dotOffline;
  if (state === 'READY' || state === 'NOT_INUSE' || state === 'IDLE' || state === 'AVAILABLE') {
    return styles.dotOnline;
  }
  return styles.dotBusy;
}

function freeCountClass(free: number, total: number): string {
  if (free <= 0) return styles.freeDanger;
  if (total > 0 && free / total < 0.5) return styles.freeWarning;
  return styles.freeOk;
}

function matchesTerm(haystacks: Array<string | undefined | null>, term: string): boolean {
  if (!term) return true;
  return haystacks.some((h) => (h || '').toLowerCase().includes(term));
}

export interface SoftphoneContactsProps {
  className?: string;
}

/**
 * Softphone Contacts tab catalog (D-11…D-14, D-25): five sticky sections with
 * unified search and click-to-call-only CTAs. Not mounted in SoftphoneWidget until 10-08.
 */
export function SoftphoneContacts({ className }: SoftphoneContactsProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUser = useAppSelector(selectCurrentUser);
  const level = useAppSelector(selectUserLevel);
  const myUserId = currentUser?.uniqueid ?? 0;
  const isSupervisor = level === UserLevel.SUPERVISOR || level === UserLevel.ADMIN;

  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ICcContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ICcContact | null>(null);

  const {
    data: directory,
    isFetching: dirFetching,
    isError: dirError,
    refetch: refetchDir,
  } = useGetTransferDirectoryQuery();
  const {
    data: history = [],
    isFetching: histFetching,
    isError: histError,
    refetch: refetchHist,
  } = useGetOperatorCallHistoryQuery();
  const {
    data: contacts = [],
    isFetching: contactsFetching,
    isError: contactsError,
    refetch: refetchContacts,
  } = useGetMyContactsQuery();
  const [clickToCall, { isLoading: isCalling }] = useClickToCallMutation();

  const term = search.trim().toLowerCase();

  const recent = useMemo(
    () => buildRecentContacts(history).filter((r) => matchesTerm([r.label, r.number], term)),
    [history, term],
  );

  const endpoints = useMemo(() => {
    if (!directory) return [] as IDirectoryEndpoint[];
    return directory.endpoints
      .filter((e) => !isEndpointUnreachable(e.presence))
      .filter((e) => matchesTerm([e.label, e.extension], term));
  }, [directory, term]);

  const queues = useMemo(() => {
    if (!directory) return [] as IDirectoryQueue[];
    return directory.queues.filter((q) => matchesTerm([q.label, q.id], term));
  }, [directory, term]);

  const groups = useMemo(() => {
    if (!directory) return [] as IDirectoryGroup[];
    return directory.groups.filter((g) => matchesTerm([g.label, g.id], term));
  }, [directory, term]);

  const book = useMemo(
    () => contacts.filter((c) => matchesTerm([c.name, c.number, c.note], term)),
    [contacts, term],
  );

  const isFetching = dirFetching || histFetching || contactsFetching;
  const hasAnyMatch =
    recent.length > 0
    || endpoints.length > 0
    || queues.length > 0
    || groups.length > 0
    || book.length > 0;
  const showBookEmpty = !term && contacts.length === 0 && !contactsFetching && !contactsError;
  const showUnifiedEmpty = Boolean(term) && !hasAnyMatch && !isFetching;
  const showLoadError = contactsError || dirError || histError;

  const ctaLabel = t('callcenter.directory.callCta', 'Call');

  const dial = async (target: string, pendingKey: string) => {
    setPendingId(pendingKey);
    try {
      const res = await clickToCall({ target }).unwrap();
      if (res.mode === 'webrtc' && res.target) {
        dispatch(requestOutboundDial(res.target));
      }
    } catch {
      /* server is source of truth — row stays interactive to retry */
    } finally {
      setPendingId(null);
    }
  };

  const isPending = (id: string) => pendingId === id && isCalling;

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (row: ICcContact) => {
    setEditing(row);
    setSheetOpen(true);
  };

  const handleRetry = () => {
    if (contactsError) void refetchContacts();
    if (dirError) void refetchDir();
    if (histError) void refetchHist();
  };

  return (
    <div
      className={`${styles.wrap}${className ? ` ${className}` : ''}`}
      data-testid="softphone-contacts"
    >
      <div className={styles.searchRow}>
        <Search className="w-4 h-4" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('callcenter.directory.searchPlaceholder', 'Search by name or number...')}
          aria-label={t('callcenter.directory.searchPlaceholder', 'Search by name or number...')}
        />
      </div>

      {showLoadError ? (
        <div className={styles.errorBanner} data-testid="softphone-contacts-error">
          <Text>{t('callcenter.contacts.loadFailed', 'Could not load contacts')}</Text>
          <Button
            type="button"
            variant="outline"
            className={styles.ctaBtn}
            onClick={handleRetry}
            aria-label={t('callcenter.settings.retry', 'Retry')}
          >
            {t('callcenter.settings.retry', 'Retry')}
          </Button>
        </div>
      ) : null}

      <div className={styles.list}>
        {showUnifiedEmpty ? (
          <div className={styles.empty} data-testid="softphone-contacts-empty">
            <Text className="font-semibold">
              {t('callcenter.directory.emptyTitle', 'Nothing found')}
            </Text>
            <Text variant="muted" className="text-sm">
              {t('callcenter.directory.emptyBody', 'Try a different number or name')}
            </Text>
          </div>
        ) : (
          <>
            {recent.length > 0 ? (
              <section className={styles.section} data-testid="contacts-section-recent">
                <div className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>
                    {t('callcenter.contacts.sectionRecent', 'Recent')}
                  </Text>
                </div>
                {recent.map((row) => (
                  <div key={`recent-${row.number}`} className={styles.row}>
                    <Phone className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
                    <div className={styles.rowMain}>
                      <Text className={styles.rowLabel}>{row.label}</Text>
                      {row.label !== row.number ? (
                        <Text variant="muted" className={`text-xs ${styles.rowMeta}`}>
                          {row.number}
                        </Text>
                      ) : null}
                    </div>
                    <Tooltip content={t('callcenter.directory.callHint', 'Place a call to this subscriber')}>
                      <Button
                        type="button"
                        size="sm"
                        className={styles.ctaBtn}
                        disabled={isPending(`recent-${row.number}`)}
                        aria-label={`${ctaLabel} ${row.label}`}
                        onClick={() => void dial(row.number, `recent-${row.number}`)}
                      >
                        {ctaLabel}
                      </Button>
                    </Tooltip>
                  </div>
                ))}
              </section>
            ) : null}

            {endpoints.length > 0 ? (
              <section className={styles.section} data-testid="contacts-section-subscribers">
                <div className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>
                    {t('callcenter.contacts.sectionSubscribers', 'Subscribers')}
                  </Text>
                </div>
                {endpoints.map((entry) => (
                  <div key={`endpoint-${entry.id}`} className={styles.row}>
                    <Users className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
                    <Tooltip content={entry.presence || t('callcenter.status.offline', 'Offline')}>
                      <span
                        className={`${styles.dot} ${presenceDotClass(entry.presence)}`}
                        role="img"
                        aria-label={entry.presence || t('callcenter.status.offline', 'Offline')}
                      />
                    </Tooltip>
                    <div className={styles.rowMain}>
                      <Text className={styles.rowLabel}>{entry.label}</Text>
                      <Text variant="muted" className="text-xs">{entry.extension}</Text>
                    </div>
                    <Tooltip content={t('callcenter.directory.callHint', 'Place a call to this subscriber')}>
                      <Button
                        type="button"
                        size="sm"
                        className={styles.ctaBtn}
                        disabled={isPending(`endpoint-${entry.id}`)}
                        aria-label={`${ctaLabel} ${entry.label}`}
                        onClick={() => void dial(entry.extension, `endpoint-${entry.id}`)}
                      >
                        {ctaLabel}
                      </Button>
                    </Tooltip>
                  </div>
                ))}
              </section>
            ) : null}

            {queues.length > 0 ? (
              <section className={styles.section} data-testid="contacts-section-queues">
                <div className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>
                    {t('callcenter.contacts.sectionQueues', 'Queues')}
                  </Text>
                </div>
                {queues.map((entry) => (
                  <div key={`queue-${entry.id}`} className={styles.row}>
                    <List className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
                    <div className={styles.rowMain}>
                      <Text className={styles.rowLabel}>{entry.label}</Text>
                    </div>
                    <Tooltip content={t('callcenter.directory.freeHint', 'Agents ready in this queue')}>
                      <span className={`${styles.freeCount} ${freeCountClass(entry.freeOperators, entry.totalOperators)}`}>
                        {entry.freeOperators} {t('callcenter.directory.free', 'free')}
                      </span>
                    </Tooltip>
                    <Tooltip content={t('callcenter.directory.callHint', 'Place a call to this subscriber')}>
                      <Button
                        type="button"
                        size="sm"
                        className={styles.ctaBtn}
                        disabled={isPending(`queue-${entry.id}`)}
                        aria-label={`${ctaLabel} ${entry.label}`}
                        onClick={() => void dial(entry.id, `queue-${entry.id}`)}
                      >
                        {ctaLabel}
                      </Button>
                    </Tooltip>
                  </div>
                ))}
              </section>
            ) : null}

            {groups.length > 0 ? (
              <section className={styles.section} data-testid="contacts-section-groups">
                <div className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>
                    {t('callcenter.contacts.sectionGroups', 'Groups')}
                  </Text>
                </div>
                {groups.map((entry) => (
                  <div key={`group-${entry.id}`} className={styles.row}>
                    <UsersRound className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
                    <div className={styles.rowMain}>
                      <Text className={styles.rowLabel}>{entry.label}</Text>
                    </div>
                    <Tooltip content={t('callcenter.directory.freeHint', 'Agents ready in this group')}>
                      <span className={`${styles.freeCount} ${freeCountClass(entry.freeOperators, entry.totalOperators)}`}>
                        {entry.freeOperators} {t('callcenter.directory.free', 'free')}
                      </span>
                    </Tooltip>
                    <Tooltip content={t('callcenter.directory.callHint', 'Place a call to this subscriber')}>
                      <Button
                        type="button"
                        size="sm"
                        className={styles.ctaBtn}
                        disabled={isPending(`group-${entry.id}`)}
                        aria-label={`${ctaLabel} ${entry.label}`}
                        onClick={() => void dial(entry.id, `group-${entry.id}`)}
                      >
                        {ctaLabel}
                      </Button>
                    </Tooltip>
                  </div>
                ))}
              </section>
            ) : null}

            {(!term && !contactsError) || book.length > 0 || showBookEmpty ? (
              <section className={styles.section} data-testid="contacts-section-book">
                <div className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>
                    {t('callcenter.contacts.sectionBook', 'Book')}
                  </Text>
                  <div className={styles.headerActions}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={styles.iconBtn}
                      onClick={openCreate}
                      aria-label={t('callcenter.softphone.addContact', 'Add contact')}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {showBookEmpty ? (
                  <div className={styles.sectionEmpty} data-testid="contacts-book-empty">
                    <Text className="font-semibold">
                      {t('callcenter.contacts.bookEmptyTitle', 'Contact book is empty')}
                    </Text>
                    <Text variant="muted" className="text-sm">
                      {t(
                        'callcenter.contacts.bookEmptyBody',
                        'Add your first contact for quick dialing',
                      )}
                    </Text>
                  </div>
                ) : (
                  book.map((row) => {
                    const manage = canManageContact(row, myUserId, isSupervisor);
                    return (
                      <div key={`book-${row.uid}`} className={styles.row} data-testid={`book-row-${row.uid}`}>
                        <BookUser className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
                        <div className={styles.rowMain}>
                          <Text className={styles.rowLabel}>{row.name}</Text>
                          <Text variant="muted" className="text-xs">{row.number}</Text>
                          {row.note ? (
                            <Text variant="muted" className={`text-xs ${styles.rowMeta}`}>
                              {row.note}
                            </Text>
                          ) : null}
                        </div>
                        <div className={styles.rowActions}>
                          {manage ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={styles.iconBtn}
                                aria-label={`${t('common.edit', 'Edit')} ${row.name}`}
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={styles.iconBtn}
                                aria-label={`${t('common.delete', 'Delete')} ${row.name}`}
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : null}
                          <Tooltip content={t('callcenter.directory.callHint', 'Place a call to this subscriber')}>
                            <Button
                              type="button"
                              size="sm"
                              className={styles.ctaBtn}
                              disabled={isPending(`book-${row.uid}`)}
                              aria-label={`${ctaLabel} ${row.name}`}
                              onClick={() => void dial(row.number, `book-${row.uid}`)}
                            >
                              {ctaLabel}
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            ) : null}
          </>
        )}
      </div>

      <ContactBookForm
        open={sheetOpen}
        editing={editing}
        deleteTarget={deleteTarget}
        myUserId={myUserId}
        onOpenChange={(next) => {
          setSheetOpen(next);
          if (!next) setEditing(null);
        }}
        onDeleteTargetChange={setDeleteTarget}
      />
    </div>
  );
}
