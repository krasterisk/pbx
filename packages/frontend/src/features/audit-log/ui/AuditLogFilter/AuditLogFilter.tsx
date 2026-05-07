import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { Input, Select, Button } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { ActionLogFilters, ActionType, EntityType } from '../../model/types/AuditLogSchema';
import cls from './AuditLogFilter.module.scss';

interface AuditLogFilterProps {
  filters: ActionLogFilters;
  onChange: (partial: Partial<ActionLogFilters>) => void;
}

const ACTIONS: { value: ActionType | ''; label: string }[] = [
  { value: '',            label: 'auditLog.filterAll'        },
  { value: 'create',      label: 'auditLog.actionCreate'     },
  { value: 'update',      label: 'auditLog.actionUpdate'     },
  { value: 'delete',      label: 'auditLog.actionDelete'     },
  { value: 'bulk_delete', label: 'auditLog.actionBulkDelete' },
  { value: 'login',       label: 'auditLog.actionLogin'      },
  { value: 'register',    label: 'auditLog.actionRegister'   },
];

const ENTITIES: { value: EntityType | ''; label: string }[] = [
  { value: '',          label: 'auditLog.filterAll'      },
  { value: 'user',      label: 'auditLog.entityUser'     },
  { value: 'endpoint',  label: 'auditLog.entityEndpoint' },
  { value: 'trunk',     label: 'auditLog.entityTrunk'    },
  { value: 'route',     label: 'auditLog.entityRoute'    },
  { value: 'context',   label: 'auditLog.entityContext'  },
  { value: 'number',    label: 'auditLog.entityNumber'   },
  { value: 'role',      label: 'auditLog.entityRole'     },
  { value: 'ivr',       label: 'auditLog.entityIvr'      },
  { value: 'auth',      label: 'auditLog.entityAuth'     },
];

const STATUSES = [
  { value: '',        label: 'auditLog.filterAll'     },
  { value: 'success', label: 'auditLog.statusSuccess' },
  { value: 'error',   label: 'auditLog.statusError'   },
];

export const AuditLogFilter = memo(({ filters, onChange }: AuditLogFilterProps) => {
  const { t } = useTranslation();

  const handleReset = useCallback(() => {
    onChange({ action: '', entity_type: '', status: '', dateFrom: '', dateTo: '', page: 1 });
  }, [onChange]);

  return (
    <HStack gap="8" className={cls.wrap}>
      <Select
        value={filters.action || ''}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange({ action: e.target.value as ActionType | '', page: 1 })
        }
        className={cls.select}
      >
        {ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>{t(a.label)}</option>
        ))}
      </Select>

      <Select
        value={filters.entity_type || ''}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange({ entity_type: e.target.value as EntityType | '', page: 1 })
        }
        className={cls.select}
      >
        {ENTITIES.map((e) => (
          <option key={e.value} value={e.value}>{t(e.label)}</option>
        ))}
      </Select>

      <Select
        value={filters.status || ''}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange({ status: e.target.value as 'success' | 'error' | '', page: 1 })
        }
        className={cls.select}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{t(s.label)}</option>
        ))}
      </Select>

      <Input
        type="date"
        value={filters.dateFrom || ''}
        onChange={(e) => onChange({ dateFrom: e.target.value, page: 1 })}
        className={cls.date}
      />
      <Input
        type="date"
        value={filters.dateTo || ''}
        onChange={(e) => onChange({ dateTo: e.target.value, page: 1 })}
        className={cls.date}
      />

      <Button size="sm" variant="ghost" onClick={handleReset} className={cls.reset}>
        <RotateCcw className={cls.resetIcon} />
      </Button>
    </HStack>
  );
});

AuditLogFilter.displayName = 'AuditLogFilter';
