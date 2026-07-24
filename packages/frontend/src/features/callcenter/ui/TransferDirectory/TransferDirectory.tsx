import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Search, Users, List, UsersRound } from 'lucide-react';
import { Input, Text, Button, Tooltip, SegmentedControl } from '@/shared/ui';
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
import { requestOutboundDial } from '@/features/callcenter/model/slice/callCenterSlice';
import styles from './TransferDirectory.module.scss';

export type TransferDirectoryMode = 'transfer' | 'conference-add' | 'call';
type TypeFilter = 'all' | 'endpoints' | 'queues' | 'groups';

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
 * True when the endpoint has no usable registration (hide from transfer list).
 * Busy/talking agents stay visible — only unreachable devices are filtered out.
 */
export function isEndpointUnreachable(presence: string | undefined): boolean {
  const state = (presence || '').toUpperCase();
  return (
    !state
    || state === 'OFFLINE'
    || state === 'UNAVAILABLE'
    || state === 'INVALID'
    || state === 'UNKNOWN'
    || state === 'NOT_FOUND'
  );
}

function presenceDotClass(presence: string | undefined): string {
  const state = (presence || '').toUpperCase();
  if (isEndpointUnreachable(state)) {
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
 * Unified transfer directory (D-36/D-37) — searchable list of endpoints/queues/groups.
 * Unregistered endpoints are hidden; type filters narrow the list.
 */
export function TransferDirectory({
  mode,
  activeCallUniqueid,
  onSelectTransferTarget,
  onDone,
  className,
}: TransferDirectoryProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const { data, isFetching } = useGetTransferDirectoryQuery();
  const [addToConference, { isLoading: isAdding }] = useAddToConferenceMutation();
  const [clickToCall, { isLoading: isCalling }] = useClickToCallMutation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows = useMemo<DirectoryRow[]>(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const endpoints = data.endpoints
      .filter((e) => !isEndpointUnreachable(e.presence))
      .map((e) => ({ ...e, type: 'endpoint' as const }));
    const queues = data.queues.map((q) => ({ ...q, type: 'queue' as const }));
    const groups = data.groups.map((g) => ({ ...g, type: 'group' as const }));

    let all: DirectoryRow[] = [];
    if (typeFilter === 'all' || typeFilter === 'endpoints') all = all.concat(endpoints);
    if (typeFilter === 'all' || typeFilter === 'queues') all = all.concat(queues);
    if (typeFilter === 'all' || typeFilter === 'groups') all = all.concat(groups);

    if (!term) return all;
    return all.filter((row) => {
      const extension = row.type === 'endpoint' ? row.extension : '';
      return row.label.toLowerCase().includes(term) || extension.toLowerCase().includes(term);
    });
  }, [data, search, typeFilter]);

  const ctaLabel = mode === 'call'
    ? t('callcenter.directory.callCta', 'Call')
    : mode === 'conference-add'
      ? t('callcenter.directory.addCta', 'Add')
      : t('callcenter.transfer.execute', 'Transfer');

  const handleEntryClick = async (entry: IDirectoryEndpoint) => {
    if (mode === 'transfer') {
      onSelectTransferTarget?.(entry);
      return;
    }
    setPendingId(entry.id);
    try {
      if (mode === 'conference-add') {
        if (!activeCallUniqueid) return;
        await addToConference({ uniqueid: activeCallUniqueid, target: entry.extension }).unwrap();
      } else {
        const res = await clickToCall({ target: entry.extension }).unwrap();
        if (res.mode === 'webrtc' && res.target) {
          dispatch(requestOutboundDial(res.target));
        }
      }
      onDone?.();
    } catch { /* server is source of truth — row stays interactive to retry */ }
    finally { setPendingId(null); }
  };

  const isPending = (id: string) => pendingId === id && (isAdding || isCalling);

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ''}`}>
      <div className={styles.filterRow}>
        <SegmentedControl
          ariaLabel={t('callcenter.directory.filterLabel', 'Directory filters')}
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            {
              value: 'all',
              label: t('callcenter.directory.filterAll', 'All'),
              tooltipContent: t('callcenter.directory.filterAllHint', 'Show subscribers, queues and groups'),
            },
            {
              value: 'endpoints',
              label: t('callcenter.directory.filterEndpoints', 'Subscribers'),
              icon: Users,
              tooltipContent: t('callcenter.directory.filterEndpointsHint', 'Registered extensions only'),
            },
            {
              value: 'queues',
              label: t('callcenter.directory.filterQueues', 'Queues'),
              icon: List,
              tooltipContent: t('callcenter.directory.filterQueuesHint', 'Call queues'),
            },
            {
              value: 'groups',
              label: t('callcenter.directory.filterGroups', 'Groups'),
              icon: UsersRound,
              tooltipContent: t('callcenter.directory.filterGroupsHint', 'Call groups'),
            },
          ]}
        />
      </div>

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
                <Tooltip content={
                  mode === 'transfer'
                    ? t('callcenter.directory.transferHint', 'Transfer the active call to this subscriber')
                    : mode === 'conference-add'
                      ? t('callcenter.directory.addHint', 'Add this subscriber to the conference')
                      : t('callcenter.directory.callHint', 'Place a call to this subscriber')
                }>
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
                </Tooltip>
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
                <Tooltip content={t('callcenter.directory.freeHint', 'Agents ready in this queue')}>
                  <span className={`${styles.freeCount} ${freeCountClass(entry.freeOperators, entry.totalOperators)}`}>
                    {entry.freeOperators} {t('callcenter.directory.free', 'free')}
                  </span>
                </Tooltip>
              </div>
            );
          }
          return (
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
