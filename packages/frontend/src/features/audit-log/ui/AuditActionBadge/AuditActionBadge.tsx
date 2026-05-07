import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ActionStatus } from '../../model/types/AuditLogSchema';
import cls from './AuditActionBadge.module.scss';

interface AuditActionBadgeProps {
  action: ActionType;
  status?: ActionStatus;
}

function getBadgeClass(action: ActionType, status?: ActionStatus): string {
  if (status === 'error') return cls.error;
  switch (action) {
    case 'create':      return cls.create;
    case 'update':      return cls.update;
    case 'delete':
    case 'bulk_delete': return cls.delete;
    case 'login':       return cls.login;
    case 'register':    return cls.register;
    default:            return cls.default;
  }
}

const ACTION_LABEL_MAP: Partial<Record<ActionType, string>> = {
  create:       'auditLog.actionCreate',
  update:       'auditLog.actionUpdate',
  delete:       'auditLog.actionDelete',
  bulk_delete:  'auditLog.actionBulkDelete',
  bulk_create:  'auditLog.actionBulkCreate',
  login:        'auditLog.actionLogin',
  register:     'auditLog.actionRegister',
};

export const AuditActionBadge = memo(({ action, status }: AuditActionBadgeProps) => {
  const { t } = useTranslation();
  const labelKey = ACTION_LABEL_MAP[action];
  const label = labelKey ? t(labelKey) : action;

  return (
    <span className={`${cls.badge} ${getBadgeClass(action, status)}`}>
      {label}
    </span>
  );
});

AuditActionBadge.displayName = 'AuditActionBadge';
