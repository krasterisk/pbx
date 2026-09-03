import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneOutgoing, X } from 'lucide-react';
import { SegmentedControl, Text } from '@/shared/ui';
import { useGetCallbackRequestsQuery } from '@/shared/api/endpoints/callbackRequestsApi';
import {
  CallbackRequestsList,
  isCallbackUrgent,
} from '@/features/callcenter/ui/CallbackRequestsList/CallbackRequestsList';
import styles from './CallbackRequestsIndicator.module.scss';

type ViewMode = 'active' | 'completed';

/** Operator badge + dropdown for callback requests (D-42 / D-50 Surface M). */
export function CallbackRequestsIndicator() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('active');
  const { data: active = [] } = useGetCallbackRequestsQuery('active');
  const { data: completed = [] } = useGetCallbackRequestsQuery('completed', { skip: !open });

  const count = active.length;
  if (count === 0 && !open) return null;

  const urgent = active.some((row) => isCallbackUrgent(row));
  const rows = view === 'active' ? active : completed;

  return (
    <div className={styles.wrap} data-testid="callback-requests-indicator">
      {count > 0 && (
        <button
          type="button"
          className={`${styles.badge}${urgent ? ` ${styles.badgeWarning}` : ''}`}
          onClick={() => setOpen((o) => !o)}
          title={t('callcenter.callback.title', 'Callbacks')}
          aria-label={`${t('callcenter.callback.title', 'Callbacks')}: ${count}`}
          aria-expanded={open}
          data-testid="callback-requests-badge"
          data-urgent={urgent ? 'true' : 'false'}
        >
          <PhoneOutgoing className="w-4 h-4" />
          <span className={styles.count}>{count}</span>
        </button>
      )}

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <Text className={styles.title}>
              <PhoneOutgoing className="w-4 h-4 inline mr-1.5" />
              {t('callcenter.callback.title', 'Callbacks')}
            </Text>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label={t('callcenter.callback.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <SegmentedControl<ViewMode>
            className={styles.viewToggle}
            ariaLabel={t('callcenter.callback.title', 'Callbacks')}
            value={view}
            onChange={setView}
            options={[
              { value: 'active', label: t('callcenter.callback.active', 'Active') },
              { value: 'completed', label: t('callcenter.callback.completed', 'Completed') },
            ]}
          />
          <CallbackRequestsList rows={rows} />
        </div>
      )}
    </div>
  );
}
