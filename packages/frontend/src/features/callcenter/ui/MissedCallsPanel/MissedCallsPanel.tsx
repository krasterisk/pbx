import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PhoneMissed, X, ChevronDown, PhoneCall, Check } from 'lucide-react';
import { Button, Text, SegmentedControl } from '@/shared/ui';
import {
  useGetMissedCallsGroupedQuery,
  useGetMissedCallsQuery,
  useClaimMissedCallMutation,
  useCallbackMissedCallMutation,
  type IMissedCallGroup,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { selectCurrentUser } from '@/entities/User';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import styles from './MissedCallsPanel.module.scss';

type ViewMode = 'active' | 'resolved';

function groupKey(g: Pick<IMissedCallGroup, 'callerIdNum' | 'personal'>): string {
  return `${g.callerIdNum}|${g.personal ? 1 : 0}`;
}

/**
 * Smart missed-calls worklist (D-16…D-19) — badge + dropdown, number-grouped
 * rows with attempt count + expandable attempt history, personal-vs-queue
 * ownership, claim (shared pool) + operator callback, and a resolved
 * sub-view distinguishing client-self-callback from operator-callback
 * success. Auto-refreshes on the existing `missedCallNew`/`missedCallUpdate`
 * SSE window events (useCallCenterSSE.ts) by invalidating the MissedCalls tag.
 */
export function MissedCallsPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('active');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [failedFlash, setFailedFlash] = useState<Record<string, boolean>>({});

  const currentUserId = useSelector(selectCurrentUser)?.uniqueid;
  const ccQueues = useSelector(selectCcQueues);
  const { data: queueList = [] } = useGetQueuesQuery();

  const { data: activeGroups = [] } = useGetMissedCallsGroupedQuery();
  // Raw rows (personal + queue, incl. resolved) power both the attempt-history
  // expansion and the resolved sub-view — one fetch, no dedicated backend endpoint needed.
  const { data: allRows = [] } = useGetMissedCallsQuery({ includeHandled: true });

  const [claimMissedCall, { isLoading: isClaiming }] = useClaimMissedCallMutation();
  const [callbackMissedCall, { isLoading: isCallingBack }] = useCallbackMissedCallMutation();

  const queueLabelSources = [
    ...ccQueues.map((q) => ({ name: q.name, displayName: q.displayName })),
    ...queueList.map((q) => ({
      name: q.name,
      displayName: q.display_name || q.name,
      exten: q.exten,
    })),
  ];

  // Inline error flash on a failed/<=5s callback attempt (D-18) — driven by the
  // missedCallUpdate SSE window event already broadcast by useCallCenterSSE.ts.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { callerIdNum?: string; attempt?: boolean } | undefined;
      if (!detail?.callerIdNum || !detail.attempt) return;
      const key = detail.callerIdNum;
      setFailedFlash((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setFailedFlash((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 6000);
    };
    window.addEventListener('cc:missed-call-update', handler);
    return () => window.removeEventListener('cc:missed-call-update', handler);
  }, []);

  const fmtAgo = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return t('callcenter.missed.justNow');
    if (m < 60) return t('callcenter.missed.agoMinutes', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('callcenter.missed.agoHours', { count: h });
    return t('callcenter.missed.agoDays', { count: Math.floor(h / 24) });
  };

  const unclaimedQueueMissedCount = useMemo(
    () => activeGroups.filter((g) => !g.personal && !g.claimedBy).length,
    [activeGroups],
  );

  // Resolved sub-view (D-17/D-18): dedupe raw rows by number+ownership, keep
  // the most recent resolution, tag client-self vs operator-callback success.
  const resolvedGroups = useMemo(() => {
    const byKey = new Map<string, { row: typeof allRows[number]; key: string }>();
    for (const row of allRows) {
      if (!row.called_back && !row.client_called_back) continue;
      const key = `${row.caller_id_num}|${row.personal ? 1 : 0}`;
      const existing = byKey.get(key);
      if (!existing || new Date(row.created_at).getTime() > new Date(existing.row.created_at).getTime()) {
        byKey.set(key, { row, key });
      }
    }
    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime(),
    );
  }, [allRows]);

  const attemptHistoryFor = (g: Pick<IMissedCallGroup, 'callerIdNum' | 'personal'>) =>
    allRows
      .filter((row) => row.caller_id_num === g.callerIdNum && row.personal === g.personal)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleClaim = async (callerIdNum: string) => {
    try {
      await claimMissedCall({ callerIdNum }).unwrap();
    } catch { /* server is source of truth on conflict — UI just reflects the refetch */ }
  };

  const handleCallback = async (callerIdNum: string) => {
    try {
      await callbackMissedCall({ callerIdNum }).unwrap();
    } catch { /* dial-initiation error (e.g. not logged in) — nothing more to do client-side */ }
  };

  const count = activeGroups.length;
  const badgeClass = unclaimedQueueMissedCount > 0 ? styles.badgeWarning : '';

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.badge} ${badgeClass}`}
        onClick={() => setOpen((o) => !o)}
        title={t('callcenter.missed.title')}
      >
        <PhoneMissed className="w-4 h-4" />
        <span className={styles.count}>{count}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <Text className={styles.title}>
              <PhoneMissed className="w-4 h-4 inline mr-1.5" />
              {t('callcenter.missed.title')}
            </Text>
            <button
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <SegmentedControl
            className={styles.viewToggle}
            ariaLabel={t('callcenter.missed.title')}
            value={view}
            onChange={setView}
            options={[
              { value: 'active', label: t('callcenter.missed.activeView', 'Active') },
              { value: 'resolved', label: t('callcenter.missed.resolvedView', 'Resolved') },
            ]}
          />

          {view === 'active' ? (
            activeGroups.length === 0 ? (
              <Text variant="muted" className="text-xs text-center py-4">
                {t('callcenter.missed.empty')}
              </Text>
            ) : (
              <div className={styles.list}>
                {activeGroups.map((g) => {
                  const key = groupKey(g);
                  const expanded = expandedKey === key;
                  const claimedByMe = g.claimedBy != null && currentUserId != null && g.claimedBy === currentUserId;
                  const claimedByOther = g.claimedBy != null && !claimedByMe;
                  return (
                    <div key={key} className={styles.row}>
                      <button
                        type="button"
                        className={styles.rowMain}
                        onClick={() => setExpandedKey(expanded ? null : key)}
                        aria-expanded={expanded}
                      >
                        <div className={styles.rowTop}>
                          <Text className={styles.rowNum}>
                            {g.callerIdNum || t('callcenter.missed.unknown')}
                          </Text>
                          <span className={styles.attemptBadge} title={t('callcenter.missed.attemptsLabel', { count: g.attemptCount })}>
                            {g.attemptCount}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 ${styles.chevron} ${expanded ? styles.chevronOpen : ''}`} />
                        </div>
                        {g.callerIdName && (
                          <Text variant="muted" className="text-xs">{g.callerIdName}</Text>
                        )}
                        <div className={styles.rowTags}>
                          {g.personal ? (
                            <span className={styles.tagPersonal}>{t('callcenter.missed.personalTag', 'Personal')}</span>
                          ) : (
                            <span className={styles.tagQueue}>
                              {queueDisplayName((g.queueName || '').replace(/^direct:/, ''), queueLabelSources) || g.queueName}
                            </span>
                          )}
                          <Text variant="muted" className="text-xs">{fmtAgo(g.lastAttemptAt)}</Text>
                        </div>
                        {claimedByOther && (
                          <Text variant="muted" className="text-xs">
                            {t('callcenter.missed.claim', 'Claim')}: #{g.claimedBy}
                          </Text>
                        )}
                      </button>

                      {failedFlash[g.callerIdNum] && (
                        <Text className={styles.errorFlash}>{t('callcenter.missed.attemptFailed')}</Text>
                      )}

                      {expanded && (
                        <div className={styles.attemptHistory}>
                          <Text variant="muted" className="text-xs font-semibold">
                            {t('callcenter.missed.attemptHistoryTitle', 'Attempt history')}
                          </Text>
                          {attemptHistoryFor(g).map((row) => (
                            <div key={row.uid ?? row.id} className={styles.attemptRow}>
                              <Text variant="muted" className="text-xs">
                                {new Date(row.created_at).toLocaleString()}
                              </Text>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={styles.rowActions}>
                        {!g.personal && !g.claimedBy && (
                          <Button size="sm" variant="outline" disabled={isClaiming} onClick={() => handleClaim(g.callerIdNum)}>
                            {isClaiming ? t('callcenter.missed.claiming', 'Claiming…') : t('callcenter.missed.claim', 'Claim')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isCallingBack}
                          onClick={() => handleCallback(g.callerIdNum)}
                        >
                          <PhoneCall className="w-3.5 h-3.5 mr-1" />
                          {isCallingBack ? t('callcenter.missed.callingBack', 'Calling…') : t('callcenter.missed.callBack')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : resolvedGroups.length === 0 ? (
            <Text variant="muted" className="text-xs text-center py-4">
              {t('callcenter.missed.emptyResolved', 'No resolved calls yet')}
            </Text>
          ) : (
            <div className={styles.list}>
              {resolvedGroups.map(({ row, key }) => (
                <div key={key} className={styles.row}>
                  <div className={styles.rowMain}>
                    <Text className={styles.rowNum}>
                      {row.caller_id_num || t('callcenter.missed.unknown')}
                    </Text>
                    {row.caller_id_name && (
                      <Text variant="muted" className="text-xs">{row.caller_id_name}</Text>
                    )}
                    <div className={styles.rowTags}>
                      {row.client_called_back ? (
                        <span className={styles.tagSuccessClient}>
                          <Check className="w-3 h-3 inline mr-1" />
                          {t('callcenter.missed.clientCalledBackTag', 'Client called back')}
                        </span>
                      ) : (
                        <span className={styles.tagSuccessOperator}>
                          <Check className="w-3 h-3 inline mr-1" />
                          {t('callcenter.missed.calledBackTag', 'Reached them')}
                        </span>
                      )}
                      <Text variant="muted" className="text-xs">{fmtAgo(row.created_at)}</Text>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
