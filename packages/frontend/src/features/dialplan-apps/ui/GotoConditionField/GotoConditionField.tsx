import { useTranslation } from 'react-i18next';
import type { IBranchCondition } from '@krasterisk/shared';
import { Input, Label, Select } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { LabelSelect } from '../LabelSelect/LabelSelect';

function hasCondition(condition: unknown): condition is IBranchCondition {
  if (!condition || typeof condition !== 'object') return false;
  const c = condition as IBranchCondition;
  return Boolean(c.source || c.dialstatus);
}

interface GotoConditionFieldProps {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function GotoConditionField({ params, onChange, readOnly }: GotoConditionFieldProps) {
  const { t } = useTranslation();
  const condition = (params.condition ?? {}) as IBranchCondition;
  const enabled = hasCondition(condition);
  const source = condition.source ?? (condition.dialstatus ? 'dialstatus' : '');

  const patchCondition = (next: Partial<IBranchCondition> | undefined) => {
    if (!next) {
      onChange({ condition: undefined, false_label: undefined });
      return;
    }
    onChange({ condition: { ...condition, ...next } });
  };

  return (
    <VStack gap="12" max>
      <HStack gap="8" align="center">
        <input
          type="checkbox"
          id="goto-conditional"
          checked={enabled}
          disabled={readOnly}
          onChange={(e) => {
            if (!e.target.checked) {
              patchCondition(undefined);
              return;
            }
            patchCondition({ source: 'variable', name: '', op: 'eq', value: '' });
          }}
        />
        <Label htmlFor="goto-conditional">
          {t('routes.chain.goto.conditional', 'Условный переход')}
        </Label>
      </HStack>

      {enabled ? (
        <VStack gap="12" max>
          <VStack gap="4" max>
            <Label>{t('routes.chain.goto.conditionSource', 'Источник условия')}</Label>
            <Select
              value={source}
              disabled={readOnly}
              onChange={(e) => {
                const next = e.target.value;
                if (next === 'dialstatus') {
                  patchCondition({ source: 'dialstatus', values: [], name: undefined, op: undefined, value: undefined });
                  return;
                }
                if (next === 'variable') {
                  patchCondition({ source: 'variable', name: '', op: 'eq', value: '', values: undefined });
                }
              }}
            >
              <option value="variable">{t('routes.chain.goto.conditionVariable', 'Переменная канала')}</option>
              <option value="dialstatus">{t('routes.chain.goto.conditionDialstatus', 'Статус набора')}</option>
            </Select>
          </VStack>

          {source === 'variable' ? (
            <HStack gap="8" max>
              <VStack gap="4" className="flex-1">
                <Label>{t('routes.chain.goto.variableName', 'Переменная')}</Label>
                <Input
                  disabled={readOnly}
                  value={condition.name ?? ''}
                  placeholder="PIN"
                  onChange={(e) => patchCondition({ name: e.target.value })}
                />
              </VStack>
              <VStack gap="4" style={{ width: '120px' }}>
                <Label>{t('routes.chain.goto.variableOp', 'Оператор')}</Label>
                <Select
                  disabled={readOnly}
                  value={condition.op ?? 'eq'}
                  onChange={(e) => patchCondition({ op: e.target.value as IBranchCondition['op'] })}
                >
                  <option value="eq">=</option>
                  <option value="ne">≠</option>
                </Select>
              </VStack>
              <VStack gap="4" className="flex-1">
                <Label>{t('routes.chain.goto.variableValue', 'Значение')}</Label>
                <Input
                  disabled={readOnly}
                  value={condition.value ?? ''}
                  onChange={(e) => patchCondition({ value: e.target.value })}
                />
              </VStack>
            </HStack>
          ) : (
            <VStack gap="4" max>
              <Label>{t('routes.chain.goto.dialstatusValue', 'DIALSTATUS')}</Label>
              <Input
                disabled={readOnly}
                value={
                  Array.isArray(condition.values)
                    ? condition.values.join(', ')
                    : String(condition.dialstatus ?? condition.values ?? '')
                }
                placeholder="ANSWER, NOANSWER"
                onChange={(e) =>
                  patchCondition({
                    source: 'dialstatus',
                    values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                  })
                }
              />
            </VStack>
          )}

          <LabelSelect
            fieldKey="false_label"
            label={t('routes.chain.goto.elseLabel', 'Иначе перейти к метке')}
            value={String(params.false_label ?? '')}
            readOnly={readOnly}
            onChange={(false_label) => onChange({ false_label })}
          />
        </VStack>
      ) : null}
    </VStack>
  );
}
