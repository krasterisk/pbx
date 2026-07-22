import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users, List, UsersRound } from 'lucide-react';
import { Input, Text, Button } from '@/shared/ui';
import {
  useGetTransferDirectoryQuery,
  useAddToConferenceMutation,
  useClickToCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import type {
  IDirectoryEndpoint,
  IDirectoryQueue,
  IDirectoryGroup,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './TransferDirectory.module.scss';

export type TransferDirectoryMode = 'transfer' | 'conference-add' | 'call';

type DirectoryRow =
  | (IDirectoryEndpoint & { type: 'endpoint' })
  | (IDirectoryQueue & { type: 'queue' })
  | (IDirectoryGroup & { type: 'group' });

export interface TransferDirectoryProps {
  /** transfer = existing blind/attended transfer target picker; conference-add = D-28 "add to conference"; call = D-29 click-to-call. One component, three call sites. */
  mode: TransferDirectoryMode;
  /** conference-add mode only — uniqueid of the operator's own active call. CTA disables without it (degrades to nothing, no active call). */
  activeCallUniqueid?: string;
  /** transfer mode only — host decides blind vs attended; this component only surfaces the picked endpoint. */
  onSelectTransferTarget?: (entry: IDirectoryEndpoint) => void;
  /** Fires after a successful conference-add/click-to-call, or a transfer pick, so the host can close its Sheet/Popover. */
  onDone?: () => void;
  className?: string;
}

/**
 * [ASSUMED] Presence bucketing over both raw AMI DeviceState/ExtensionState
 * strings (NOT_INUSE/INUSE/BUSY/RINGING/UNAVAILABLE/...) and the CC AgentStatus
 * fallback (READY/IN_CALL/PAUSED/...) that CallCenterPresenceService.getPresence
 * (09-11) may return — casing/values unverified against a live Asterisk
 * instance (09-VALIDATION carries the same flag for the presence source).
 */
function presenceDotClass(presence: string | undefined): string {
  const state = (presence || '').toUpperCase();
  if (!state || state === 'OFFLINE' || state === 'UNAVAILABLE' || state === 'INVALID' || state === 'UNKNOWN') {
    return styles.dotOffline;
  }
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

/**
 * Unified transfer directory (D-36/D-37) — one searchable list mixing internal
 * endpoints, queues and call groups, each with a type icon; endpoints carry a
 * live BLF presence dot (patched by presenceUpdate SSE, see useCallCenterSSE.ts),
 * queues/groups show a free-operator count with the same warning/danger
 * thresholds as QueuesTab. Serves three call sites via `mode` (D-29): transfer
 * target, conference-add, click-to-call — never three bespoke pickers.
 */
export function TransferDirectory({
  mode,
  activeCallUniqueid,
  onSelectTransferTarget,
  onDone,
  className,
}: TransferDirectoryProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  // Always unfiltered — filtering client-side keeps a single cache entry so
  // the presenceUpdate SSE patch (useCallCenterSSE.ts) always targets the
  // list this component renders, regardless of what the operator typed (D-45).
  const { data, isFetching } = useGetTransferDirectoryQuery();
  const [addToConference, { isLoading: isAdding }] = useAddToConferenceMutation();
  const [clickToCall, { isLoading: isCalling }] = useClickToCallMutation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows = useMemo<DirectoryRow[]>(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const all: DirectoryRow[] = [
      ...data.endpoints.map((e) => ({ ...e, type: 'endpoint' as const })),
      ...data.queues.map((q) => ({ ...q, type: 'queue' as const })),
      ...data.groups.map((g) => ({ ...g, type: 'group' as const })),
    ];
    if (!term) return all;
    return all.filter((row) => {
      const extension = row.type === 'endpoint' ? row.extension : '';
      return row.label.toLowerCase().includes(term) || extension.toLowerCase().includes(term);
    });
  }, [data, search]);

  const ctaLabel = mode === 'call'
    ? t('callcenter.directory.callCta', 'Call')
    : mode === 'conference-add'
      ? t('callcenter.directory.addCta', 'Add')
      : t('callcenter.transfer.execute', 'Transfer');

  const handleEntryClick = async (entry: IDirectoryEndpoint) => {
    if (mode === 'transfer') {
      onSelectTransferTarget?.(entry);
      onDone?.();
      return;
    }
    setPendingId(entry.id);
    try {
      if (mode === 'conference-add') {
        if (!activeCallUniqueid) return;
        await addToConference({ uniqueid: activeCallUniqueid, target: entry.extension }).unwrap();
      } else {
        await clickToCall({ target: entry.extension }).unwrap();
      }
      onDone?.();
    } catch { /* server is source of truth — row stays interactive to retry */ }
    finally { setPendingId(null); }
  };

  const isPending = (id: string) => pendingId === id && (isAdding || isCalling);

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ''}`}>
      <div className={styles.searchRow}>
        <Search className="w-4 h-4" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('callcenter.directory.searchPlaceholder', 'Search by name or number...')}
          aria-label={t('callcenter.directory.searchPlaceholder', 'Search by name or number...')}
        />
      </div>

      <div className={styles.list}>
        {rows.length === 0 && !isFetching ? (
          <div className={styles.empty}>
            <Text className="font-semibold">{t('callcenter.directory.emptyTitle', 'Nothing found')}</Text>
            <Text variant="muted" className="text-sm">
              {t('callcenter.directory.emptyBody', 'Try a different number or name')}
            </Text>
          </div>
        ) : rows.map((entry) => {
          if (entry.type === 'endpoint') {
            return (
              <div key={`endpoint-${entry.id}`} className={styles.row}>
                <Users className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
                <span
                  className={`${styles.dot} ${presenceDotClass(entry.presence)}`}
                  role="img"
                  aria-label={entry.presence || t('callcenter.status.offline', 'Offline')}
                />
                <div className={styles.rowMain}>
                  <Text className={styles.rowLabel}>{entry.label}</Text>
                  <Text variant="muted" className="text-xs">{entry.extension}</Text>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={styles.ctaBtn}
                  disabled={isPending(entry.id) || (mode === 'conference-add' && !activeCallUniqueid)}
                  aria-label={`${ctaLabel} ${entry.label}`}
                  onClick={() => void handleEntryClick(entry)}
                >
                  {ctaLabel}
                </Button>
              </div>
            );
          }
          if (entry.type === 'queue') {
            return (
              <div key={`queue-${entry.id}`} className={styles.row}>
                <List className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
                <div className={styles.rowMain}>
                  <Text className={styles.rowLabel}>{entry.label}</Text>
                </div>
                <span className={`${styles.freeCount} ${freeCountClass(entry.freeOperators, entry.totalOperators)}`}>
                  {entry.freeOperators} {t('callcenter.directory.free', 'free')}
                </span>
              </div>
            );
          }
          return (
            <div key={`group-${entry.id}`} className={styles.row}>
              <UsersRound className={`w-4 h-4 ${styles.typeIcon}`} aria-hidden />
              <div className={styles.rowMain}>
                <Text className={styles.rowLabel}>{entry.label}</Text>
              </div>
              <span className={`${styles.freeCount} ${freeCountClass(entry.freeOperators, entry.totalOperators)}`}>
                {entry.freeOperators} {t('callcenter.directory.free', 'free')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
