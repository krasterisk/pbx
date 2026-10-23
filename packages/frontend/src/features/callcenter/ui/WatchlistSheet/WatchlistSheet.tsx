import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import {
  Button,
  Checkbox,
  Flex,
  HStack,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Text,
  VStack,
} from '@/shared/ui';
import type { IAgent } from '../../model/types/callCenterSchema';
import {
  groupWatchlistCandidates,
  toggleGroupSelection,
  type WatchlistCandidate,
} from '../../lib/watchlistGroups';
import styles from './WatchlistSheet.module.scss';

export interface WatchlistSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: readonly WatchlistCandidate[];
  agents: readonly Pick<IAgent, 'userId' | 'queues'>[];
  queueLabel: (queueName: string) => string;
  selectedUserIds: readonly number[];
  onSelectedChange: (next: number[]) => void;
  onSave: () => void;
  saving?: boolean;
  error?: string;
  flat?: boolean;
}

function candidateLabel(c: WatchlistCandidate, noExtension: string): string {
  const name = c.name.trim();
  const ext = c.exten.trim();
  if (name && ext) return `${name} (${ext})`;
  if (name) return `${name} (${noExtension})`;
  return ext || noExtension;
}

/**
 * Supervised-operators picker (U1.7): search, grouped by queue, "select all in queue".
 * Replaces the flat checkbox dialog that did not scale past ~30 operators.
 */
export function WatchlistSheet({
  open,
  onOpenChange,
  candidates,
  agents,
  queueLabel,
  selectedUserIds,
  onSelectedChange,
  onSave,
  saving = false,
  error,
  flat = false,
}: WatchlistSheetProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const groups = useMemo(
    () =>
      groupWatchlistCandidates(
        candidates,
        agents,
        queueLabel,
        t('callcenter.supervisor.cockpit.watchlistUnassigned', 'Outside queues'),
        search,
      ),
    [candidates, agents, queueLabel, search, t],
  );

  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const noExtension = t('callcenter.supervisor.noExtension', 'no number');

  const toggleOne = (userId: number) => {
    onSelectedChange(
      selectedSet.has(userId)
        ? selectedUserIds.filter((id) => id !== userId)
        : [...selectedUserIds, userId],
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby={undefined} data-testid="cc-watchlist-sheet">
        <SheetHeader>
          <SheetTitle>{flat ? t('callcenter.supervisor.pulse.myTeam') : t('callcenter.supervisor.watchlistTitle', 'Supervised agents')}</SheetTitle>
          <Text variant="muted" className={styles.hint}>
            {flat ? t('callcenter.supervisor.pulse.teamHint') : t('callcenter.supervisor.watchlistHint', 'Pick users. An extension is assigned only when the shift starts.')}
          </Text>
        </SheetHeader>

        <HStack gap="8" align="center" className={styles.searchRow}>
          <Search size={16} aria-hidden="true" />
          <Input
            value={search}
            disabled={saving}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('callcenter.supervisor.cockpit.watchlistSearch', 'Find an operator…')}
            aria-label={t('callcenter.supervisor.cockpit.watchlistSearch', 'Find an operator…')}
            data-testid="cc-watchlist-search"
          />
        </HStack>

        <VStack gap="12" className={styles.list} data-testid="cc-watchlist-list">
          {candidates.length === 0 ? (
            <Text variant="muted">{t('callcenter.supervisor.candidatesEmpty', 'No available agents')}</Text>
          ) : groups.length === 0 ? (
            <Text variant="muted">{t('callcenter.supervisor.cockpit.watchlistNoMatch', 'Nobody found')}</Text>
          ) : flat ? (
            [...new Map(groups.flatMap(group => group.candidates).map(candidate => [candidate.userId, candidate])).values()]
              .sort((a, b) => a.name.localeCompare(b.name)).map(candidate => (
                <Label key={candidate.userId} className={styles.item}>
                  <Checkbox checked={selectedSet.has(candidate.userId)} disabled={saving}
                    onChange={() => toggleOne(candidate.userId)} />
                  <Text>{candidateLabel(candidate, noExtension)}</Text>
                </Label>
              ))
          ) : (
            groups.map((group) => {
              const ids = group.candidates.map((c) => c.userId);
              const selectedInGroup = ids.filter((id) => selectedSet.has(id)).length;
              const allSelected = ids.length > 0 && selectedInGroup === ids.length;
              return (
                <VStack key={group.id} gap="4" data-testid={`cc-watchlist-group-${group.id}`}>
                  <Flex align="center" justify="between" gap="8" className={styles.groupHeader}>
                    <Text variant="small" className={styles.groupTitle}>
                      {group.label} · {selectedInGroup}/{ids.length}
                    </Text>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onSelectedChange(toggleGroupSelection(selectedUserIds, ids))}
                      data-testid={`cc-watchlist-toggle-${group.id}`}
                    >
                      {allSelected
                        ? t('callcenter.supervisor.cockpit.watchlistClearGroup', 'Clear')
                        : t('callcenter.supervisor.cockpit.watchlistSelectGroup', 'Select all')}
                    </Button>
                  </Flex>
                  {group.candidates.map((c) => (
                    <Label key={`${group.id}:${c.userId}`} className={styles.item}>
                      <Checkbox checked={selectedSet.has(c.userId)} onChange={() => toggleOne(c.userId)} />
                      <span>{candidateLabel(c, noExtension)}</span>
                      {c.online ? (
                        <Text as="span" variant="xs" className={styles.online}>
                          {t('callcenter.supervisor.cockpit.watchlistOnline', 'online')}
                        </Text>
                      ) : null}
                    </Label>
                  ))}
                </VStack>
              );
            })
          )}
        </VStack>

        {error ? <div role="alert"><Text variant="error">{error}</Text></div> : null}
        <SheetFooter className={styles.footer}>
          <Text variant="muted" className={styles.counter}>
            {t('callcenter.supervisor.cockpit.watchlistSelected', 'Selected: {{count}}', {
              count: selectedUserIds.length,
            })}
          </Text>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t('callcenter.supervisor.cancel', 'Cancel')}
          </Button>
          <Button onClick={onSave} disabled={saving} data-testid="cc-watchlist-save">
            {t('callcenter.supervisor.watchlistSave', 'Save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
