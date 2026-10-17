import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneForwarded, Search } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogHeader,
  DialogTitle,
  FormDialogContent,
  HStack,
  Input,
  ModalBody,
  SegmentedControl,
  Text,
  VStack,
} from '@/shared/ui';
import { useGetTransferDirectoryQuery } from '@/shared/api/endpoints/callCenterApi';
import {
  filterTransferTargets,
  looksDialable,
  loadRecentTransferTargets,
  resolveEnterTarget,
  type TransferTarget,
} from '../../lib/transferTargets';
import { isEndpointUnreachable } from '../TransferDirectory/TransferDirectory';
import { endpointPresenceLabel } from '../../lib/displayLabels';
import type { ConsultationState } from '../../lib/consultation';
import styles from './AgentTransferDialog.module.scss';

export type AgentTransferType = 'blind' | 'attended';

export interface AgentTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: AgentTransferType;
  onTypeChange: (type: AgentTransferType) => void;
  busy?: boolean;
  error?: string | null;
  /** Starts the transfer. The host closes the dialog on success. */
  onTransfer: (target: TransferTarget) => void | Promise<void>;
  consultation?: ConsultationState | null;
  consultationSupported?: boolean;
  onConsultCancel?: () => void;
  onConsultComplete?: () => void;
}

/**
 * Call transfer dialog (U2.5): "Direct / With consultation" switch, one search field that also
 * accepts a typed number, recent targets and the colleagues directory with presence.
 * Enter on a found (or dialable) target starts the transfer; Esc closes.
 */
export function AgentTransferDialog({
  open,
  onOpenChange,
  type,
  onTypeChange,
  busy = false,
  error,
  onTransfer,
  consultation,
  consultationSupported = true,
  onConsultCancel,
  onConsultComplete,
}: AgentTransferDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<TransferTarget[]>([]);
  const { data } = useGetTransferDirectoryQuery(undefined, { skip: !open });

  useEffect(() => {
    if (open) {
      setQuery('');
      setRecents(loadRecentTransferTargets());
    }
  }, [open]);

  const all = useMemo<TransferTarget[]>(
    () =>
      (data?.endpoints ?? [])
        .filter((e) => !isEndpointUnreachable(e.presence))
        .map((e) => ({ value: e.extension, label: e.label, presence: e.presence })),
    [data],
  );
  const matches = useMemo(() => filterTransferTargets(all, query), [all, query]);
  const showRecents = !query.trim() && recents.length > 0;

  const start = (target: TransferTarget) => {
    if (busy) return;
    void onTransfer(target);
  };

  const onEnter = () => {
    const value = resolveEnterTarget(query, matches);
    if (!value) return;
    const found = matches.find((m) => m.value === value);
    start(found ?? { value, label: value });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <FormDialogContent aria-describedby={undefined} data-testid="cc-agent-transfer-dialog">
        <DialogHeader>
          <DialogTitle>
            <PhoneForwarded className="w-5 h-5 inline mr-2" aria-hidden="true" />
            {t('callcenter.transfer.title', 'Transfer Call')}
          </DialogTitle>
        </DialogHeader>
        <ModalBody>
          <VStack gap="12" max>
            {error ? <Text className={styles.error} role="alert">{error}</Text> : null}
            {consultation ? (
              <VStack gap="12" max>
                <Text role="status">{t(`callcenter.transfer.consult.${consultation.phase}`, { number: consultation.target })}</Text>
                <Text variant="muted">{t('callcenter.transfer.consult.clientHeld')}</Text>
                <HStack gap="8" wrap="wrap">
                  <Button disabled={busy || consultation.phase !== 'connected'} onClick={onConsultComplete}>{t('callcenter.transfer.consult.complete')}</Button>
                  <Button variant="outline" disabled={busy || consultation.phase === 'transferring'} onClick={onConsultCancel}>{t('callcenter.transfer.consult.cancel')}</Button>
                </HStack>
              </VStack>
            ) : <>
            <SegmentedControl<AgentTransferType>
              ariaLabel={t('callcenter.transfer.typeLabel', 'Transfer type')}
              value={type}
              onChange={onTypeChange}
              options={[
                {
                  value: 'blind',
                  label: t('callcenter.transfer.directLabel', 'Direct'),
                  tooltipContent: t('callcenter.transfer.blindHint', 'Hang up immediately and send the caller to the target'),
                },
                {
                  value: 'attended',
                  disabled: !consultationSupported,
                  label: t('callcenter.transfer.consultLabel', 'With consultation'),
                  tooltipContent: t('callcenter.transfer.attendedHint', 'Consult with the target first, then complete the transfer'),
                },
              ]}
            />
            {!consultationSupported && <Text variant="muted">{t('callcenter.transfer.consult.hardware')}</Text>}

            <HStack gap="8" align="center" className={styles.searchRow}>
              <Search className="w-4 h-4" aria-hidden="true" />
              <Input
                autoFocus
                value={query}
                disabled={busy}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onEnter();
                  }
                }}
                placeholder={t('callcenter.transfer.searchPlaceholder', 'Name or number…')}
                aria-label={t('callcenter.transfer.searchPlaceholder', 'Name or number…')}
                data-testid="cc-transfer-search"
              />
            </HStack>

            {looksDialable(query) && (
              <Button disabled={busy} onClick={() => start({ value: query.trim(), label: query.trim() })}>
                {t('callcenter.transfer.toNumber', 'Transfer to {{number}}', { number: query.trim() })}
              </Button>
            )}


            {showRecents ? (
              <VStack gap="4" max data-testid="cc-transfer-recents">
                <Text variant="xs" className={styles.groupTitle}>
                  {t('callcenter.transfer.recents', 'Recent')}
                </Text>
                <HStack gap="8" wrap="wrap">
                  {recents.map((r) => (
                    <Button
                      key={r.value}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => start(r)}
                      data-testid={`cc-transfer-recent-${r.value}`}
                    >
                      {r.label}
                    </Button>
                  ))}
                </HStack>
              </VStack>
            ) : null}

            <VStack gap="2" max className={styles.list} role="listbox" aria-label={t('callcenter.transfer.colleagues', 'Colleagues')}>
              {matches.length === 0 ? (
                <Text variant="muted" className={styles.empty} data-testid="cc-transfer-empty">
                  {t('callcenter.transfer.noMatches', 'No match. Press Enter to dial a typed number.')}
                </Text>
              ) : (
                matches.map((m) => (
                  <Button
                    key={m.value}
                    type="button"
                    variant="unstyled"
                    size="none"
                    role="option"
                    aria-selected={false}
                    className={styles.option}
                    disabled={busy}
                    onClick={() => start(m)}
                    data-testid={`cc-transfer-option-${m.value}`}
                  >
                    <Text as="span">{m.label}</Text>
                    <Text as="span" variant="xs" className={styles.ext}>
                      {m.value}
                      {m.presence ? ` · ${endpointPresenceLabel(m.presence, t)}` : ''}
                    </Text>
                  </Button>
                ))
              )}
            </VStack>
            </>}
          </VStack>
        </ModalBody>
      </FormDialogContent>
    </Dialog>
  );
}
