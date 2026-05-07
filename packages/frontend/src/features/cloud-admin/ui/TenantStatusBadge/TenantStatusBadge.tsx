import { useTranslation } from 'react-i18next';
import type { TenantStatus } from '@/entities/tenant';
import cls from './TenantStatusBadge.module.scss';

interface TenantStatusBadgeProps {
  status: TenantStatus;
}

const STATUS_LABELS: Record<TenantStatus, string> = {
  active:    'cloudAdmin.status.active',
  trial:     'cloudAdmin.status.trial',
  suspended: 'cloudAdmin.status.suspended',
  cancelled: 'cloudAdmin.status.cancelled',
};

export const TenantStatusBadge = ({ status }: TenantStatusBadgeProps) => {
  const { t } = useTranslation();

  return (
    <span className={`${cls.badge} ${cls[status]}`}>
      <span className={cls.dot} />
      {t(STATUS_LABELS[status], STATUS_LABELS[status])}
    </span>
  );
};
