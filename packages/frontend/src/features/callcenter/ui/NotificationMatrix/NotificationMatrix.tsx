import { useTranslation } from 'react-i18next';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Switch, Tooltip,
} from '@/shared/ui';
import type { NotificationChannel, NotificationEvent, NotificationMatrix as NotificationMatrixType } from '@/shared/api/endpoints/callCenterApi';

const EVENT_ORDER: NotificationEvent[] = [
  'incoming_call',
  'missed_call',
  'queue_missed_pool',
  'sla_threshold',
  'chat_message',
  'spy_connected',
];

const CHANNEL_ORDER: NotificationChannel[] = ['chat', 'sound', 'popup'];

export interface NotificationMatrixProps {
  matrix: NotificationMatrixType;
  locks: NotificationMatrixType;
  defaults: NotificationMatrixType;
  onChange: (event: NotificationEvent, channel: NotificationChannel, enabled: boolean) => void;
  /** Disables every cell (e.g. while a save is in flight) regardless of lock state. */
  disabled?: boolean;
}

/**
 * D-41/D-42/D-43: event × channel notification grid - 6 event rows, 3 channel columns
 * (Chat/Sound/Popup, Copywriting Contract). Reused as-is for both the per-operator
 * settings screen (this plan) and, per UI-SPEC Surface 12, the future admin
 * role-default/lock screen - one row/column/lock pattern for both, so this component
 * takes matrix/locks/defaults as plain props rather than owning its own data fetch.
 */
export function NotificationMatrix({ matrix, locks, defaults, onChange, disabled }: NotificationMatrixProps) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('callcenter.settings.notifications.eventColumn', 'Event')}</TableHead>
          {CHANNEL_ORDER.map((channel) => (
            <TableHead key={channel} className="text-center">
              {t(`callcenter.settings.notifications.columns.${channel}`)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {EVENT_ORDER.map((event) => {
          const isLocked = (locks[event]?.length ?? 0) > 0;
          const effectiveChannels = isLocked ? (defaults[event] ?? []) : (matrix[event] ?? defaults[event] ?? []);
          const rowLabel = t(`callcenter.settings.notifications.events.${event}`);

          return (
            <TableRow key={event}>
              <TableCell>
                {isLocked ? (
                  <Tooltip content={t('callcenter.settings.lockedHint', 'Set by administrator')}>
                    <span>{rowLabel}</span>
                  </Tooltip>
                ) : (
                  <span>{rowLabel}</span>
                )}
              </TableCell>
              {CHANNEL_ORDER.map((channel) => {
                const checked = effectiveChannels.includes(channel);
                return (
                  <TableCell key={channel} className="text-center">
                    <Switch
                      checked={checked}
                      disabled={disabled || isLocked}
                      onCheckedChange={(next) => onChange(event, channel, next)}
                      aria-label={`${rowLabel}, ${t(`callcenter.settings.notifications.columns.${channel}`)}`}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
