import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type {
  DialRewriteCharset,
  DialRewriteCondition,
  DialRewriteConditionKind,
  DialRewriteRule,
  DialTargetRewrite,
  ValueSource,
} from '@krasterisk/shared';
import {
  coerceDialTargetRewrite,
  createEmptyRewriteRule,
  evaluateDialTargetRewrite,
} from '@krasterisk/shared';
import { Button, Input, Label, Select, Switch, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { ValueSourceField } from '../ValueSourceField/ValueSourceField';
import type { SchemaFieldRenderCtx } from '../../model/schema.types';
import styles from './DialTargetRewriteEditor.module.scss';

export function renderDialRewriteField(ctx: SchemaFieldRenderCtx) {
  return (
    <DialTargetRewriteEditor
      rewrite={coerceDialTargetRewrite(ctx.params) ?? ctx.params.rewrite}
      onRewriteChange={(rewrite) => ctx.onChange({ rewrite, strip: undefined, prepend: undefined, numberManipulation: undefined })}
      readOnly={ctx.readOnly}
    />
  );
}

const CONDITION_KINDS: DialRewriteConditionKind[] = [
  'eq',
  'startsWith',
  'endsWith',
  'length',
  'digitMask',
  'regex',
];

export interface DialTargetRewriteEditorProps {
  rewrite?: DialTargetRewrite | unknown;
  onRewriteChange: (next: DialTargetRewrite) => void;
  source?: ValueSource | string | number;
  onSourceChange?: (next: ValueSource) => void;
  sourceLabel?: string;
  charset?: DialRewriteCharset;
  tenantUid?: number;
  readOnly?: boolean;
  showSource?: boolean;
  /** When embedded in DialModifyField the parent owns the live preview block. */
  hidePreview?: boolean;
}

function asRewrite(raw: unknown): DialTargetRewrite {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as DialTargetRewrite).rules)) {
    return raw as DialTargetRewrite;
  }
  return coerceDialTargetRewrite({ rewrite: raw, ...(raw as object) }) ?? { noMatch: 'passthrough', rules: [] };
}

function newId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

export function DialTargetRewriteEditor({
  rewrite: rewriteProp,
  onRewriteChange,
  source,
  onSourceChange,
  sourceLabel,
  charset = 'phone',
  tenantUid = 0,
  readOnly,
  showSource = false,
  hidePreview = false,
}: DialTargetRewriteEditorProps) {
  const { t } = useTranslation();
  const rewrite = asRewrite(rewriteProp);
  const rules = useMemo(() => rewrite.rules ?? [], [rewrite.rules]);
  const [sample, setSample] = useState('79001234567');

  const preview = useMemo(
    () => evaluateDialTargetRewrite(sample, rewrite, charset),
    [sample, rewrite, charset],
  );

  const matchedRuleN = useMemo(() => {
    if (!preview.matchedRuleId) return null;
    const idx = rules.findIndex((rule) => rule.id === preview.matchedRuleId);
    return idx >= 0 ? idx + 1 : null;
  }, [preview.matchedRuleId, rules]);

  const commit = (next: DialTargetRewrite) => onRewriteChange(next);

  const updateRule = (index: number, patch: Partial<DialRewriteRule>) => {
    const next = rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule));
    commit({ ...rewrite, rules: next });
  };

  const moveRule = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    commit({ ...rewrite, rules: next });
  };

  return (
    <VStack gap="12" max className={styles.editor}>
      {showSource && onSourceChange ? (
        <ValueSourceField
          value={source as ValueSource}
          onChange={(next) => onSourceChange(next ?? { source: 'route_pattern' })}
          tenantUid={tenantUid}
          label={sourceLabel ?? t('routes.chain.fields.dest', 'Назначение')}
          mode="dial"
          readOnly={readOnly}
        />
      ) : null}

      <VStack gap="8" max>
        <HStack gap="4" align="center">
          <Label className={styles.label}>
            {t('routes.chain.rewrite.noMatch', 'Если правило не подошло')}
          </Label>
          <InfoTooltip
            text={t(
              'routes.chain.rewrite.noMatchHint',
              '**Оставить** - набрать исходный номер.\n**Не набирать** - шаг завершится ошибкой.',
            )}
          />
        </HStack>
        <Select
          disabled={readOnly}
          value={rewrite.noMatch === 'reject' ? 'reject' : 'passthrough'}
          aria-label={t('routes.chain.rewrite.noMatch', 'Если правило не подошло')}
          onChange={(e) => commit({ ...rewrite, noMatch: e.target.value === 'reject' ? 'reject' : 'passthrough' })}
        >
          <option value="passthrough">
            {t('routes.chain.rewrite.passthrough', 'Оставить без изменений')}
          </option>
          <option value="reject">
            {t('routes.chain.rewrite.reject', 'Не набирать')}
          </option>
        </Select>
      </VStack>

      {rules.map((rule, index) => (
        <VStack gap="8" max key={rule.id || index} className={styles.rule}>
          <HStack gap="8" align="center" max justify="between">
            <Text>
              {t('routes.chain.rewrite.rule', 'Правило {{n}}').replace('{{n}}', String(index + 1))}
            </Text>
            <HStack gap="4" align="center">
              <Switch
                checked={rule.enabled !== false}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.enabled', 'Включено')}
                onCheckedChange={(checked) => updateRule(index, { enabled: checked })}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={readOnly || index === 0}
                aria-label={t('common.up', 'Выше')}
                onClick={() => moveRule(index, -1)}
              >
                <ChevronUp size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={readOnly || index === rules.length - 1}
                aria-label={t('common.down', 'Ниже')}
                onClick={() => moveRule(index, 1)}
              >
                <ChevronDown size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={readOnly}
                aria-label={t('common.delete', 'Удалить')}
                onClick={() => commit({ ...rewrite, rules: rules.filter((_, i) => i !== index) })}
              >
                <Trash2 size={16} />
              </Button>
            </HStack>
          </HStack>

          <Text variant="muted">
            {(rule.conditions ?? []).length === 0
              ? t('routes.chain.rewrite.anyNumber', 'Для любого номера')
              : t('routes.chain.rewrite.when', 'Когда номер')}
          </Text>
          {(rule.conditions ?? []).map((condition, cIndex) => (
            <HStack gap="8" align="end" max key={`${rule.id}-c-${cIndex}`}>
              <Select
                disabled={readOnly}
                value={condition.kind}
                aria-label={t('routes.chain.rewrite.conditionKind', 'Условие')}
                onChange={(e) => {
                  const next = [...(rule.conditions ?? [])];
                  next[cIndex] = { ...condition, kind: e.target.value as DialRewriteConditionKind };
                  updateRule(index, { conditions: next });
                }}
              >
                {CONDITION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`routes.chain.rewrite.cond.${kind}`, kind)}
                  </option>
                ))}
              </Select>
              {condition.kind === 'length' ? (
                <>
                  <Input
                    className={styles.narrow}
                    type="number"
                    inputMode="numeric"
                    disabled={readOnly}
                    value={condition.min ?? ''}
                    aria-label={t('routes.chain.rewrite.min', 'От')}
                    onChange={(e) => {
                      const next = [...(rule.conditions ?? [])];
                      next[cIndex] = {
                        ...condition,
                        min: e.target.value === '' ? undefined : Number(e.target.value),
                      };
                      updateRule(index, { conditions: next });
                    }}
                  />
                  <Input
                    className={styles.narrow}
                    type="number"
                    inputMode="numeric"
                    disabled={readOnly}
                    value={condition.max ?? ''}
                    aria-label={t('routes.chain.rewrite.max', 'До')}
                    onChange={(e) => {
                      const next = [...(rule.conditions ?? [])];
                      next[cIndex] = {
                        ...condition,
                        max: e.target.value === '' ? undefined : Number(e.target.value),
                      };
                      updateRule(index, { conditions: next });
                    }}
                  />
                </>
              ) : (
                <Input
                  value={condition.value ?? ''}
                  disabled={readOnly}
                  aria-label={t('routes.chain.rewrite.conditionValue', 'Значение условия')}
                  onChange={(e) => {
                    const next = [...(rule.conditions ?? [])];
                    next[cIndex] = { ...condition, value: e.target.value };
                    updateRule(index, { conditions: next });
                  }}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.removeCondition', 'Удалить условие')}
                onClick={() => {
                  updateRule(index, {
                    conditions: (rule.conditions ?? []).filter((_, i) => i !== cIndex),
                  });
                }}
              >
                <Trash2 size={14} />
              </Button>
            </HStack>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={readOnly}
            onClick={() => {
              const next: DialRewriteCondition = { kind: 'startsWith', value: '' };
              updateRule(index, { conditions: [...(rule.conditions ?? []), next] });
            }}
          >
            <Plus size={14} />
            <Text>{t('routes.chain.rewrite.addCondition', 'Добавить условие')}</Text>
          </Button>

          <Label className={styles.label}>{t('routes.chain.rewrite.replaceAll', 'Заменить целиком')}</Label>
          <Input
            value={rule.transform?.replaceAll ?? ''}
            disabled={readOnly}
            aria-label={t('routes.chain.rewrite.replaceAll', 'Заменить целиком')}
            onChange={(e) => updateRule(index, { transform: { ...rule.transform, replaceAll: e.target.value } })}
          />
          <HStack gap="8" max>
            <VStack gap="4">
              <Label className={styles.label}>{t('routes.chain.rewrite.stripStartCount', 'Срезать с начала')}</Label>
              <Input
                className={styles.narrow}
                type="number"
                inputMode="numeric"
                value={rule.transform?.stripStartCount ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.stripStartCount', 'Срезать с начала')}
                onChange={(e) => updateRule(index, {
                  transform: {
                    ...rule.transform,
                    stripStartCount: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })}
              />
            </VStack>
            <VStack gap="4" max>
              <Label className={styles.label}>{t('routes.chain.rewrite.stripStartText', 'Удалить префикс')}</Label>
              <Input
                value={rule.transform?.stripStartText ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.stripStartText', 'Удалить префикс')}
                onChange={(e) => updateRule(index, { transform: { ...rule.transform, stripStartText: e.target.value } })}
              />
            </VStack>
          </HStack>
          <HStack gap="8" max>
            <VStack gap="4">
              <Label className={styles.label}>{t('routes.chain.rewrite.stripEndCount', 'Срезать с конца')}</Label>
              <Input
                className={styles.narrow}
                type="number"
                inputMode="numeric"
                value={rule.transform?.stripEndCount ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.stripEndCount', 'Срезать с конца')}
                onChange={(e) => updateRule(index, {
                  transform: {
                    ...rule.transform,
                    stripEndCount: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })}
              />
            </VStack>
            <VStack gap="4" max>
              <Label className={styles.label}>{t('routes.chain.rewrite.stripEndText', 'Удалить окончание')}</Label>
              <Input
                value={rule.transform?.stripEndText ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.stripEndText', 'Удалить окончание')}
                onChange={(e) => updateRule(index, { transform: { ...rule.transform, stripEndText: e.target.value } })}
              />
            </VStack>
          </HStack>
          <HStack gap="8" max>
            <VStack gap="4" max>
              <Label className={styles.label}>{t('routes.chain.rewrite.replaceFind', 'Заменить')}</Label>
              <Input
                value={rule.transform?.replaceFind ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.replaceFind', 'Заменить')}
                onChange={(e) => updateRule(index, { transform: { ...rule.transform, replaceFind: e.target.value } })}
              />
            </VStack>
            <VStack gap="4" max>
              <Label className={styles.label}>{t('routes.chain.rewrite.replaceWith', 'На')}</Label>
              <Input
                value={rule.transform?.replaceWith ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.replaceWith', 'На')}
                onChange={(e) => updateRule(index, { transform: { ...rule.transform, replaceWith: e.target.value } })}
              />
            </VStack>
          </HStack>
          <HStack gap="8" max>
            <VStack gap="4" max>
              <Label className={styles.label}>{t('routes.chain.rewrite.prefix', 'Добавить префикс')}</Label>
              <Input
                value={rule.transform?.prefix ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.prefix', 'Добавить префикс')}
                onChange={(e) => updateRule(index, { transform: { ...rule.transform, prefix: e.target.value } })}
              />
            </VStack>
            <VStack gap="4" max>
              <Label className={styles.label}>{t('routes.chain.rewrite.postfix', 'Добавить окончание')}</Label>
              <Input
                value={rule.transform?.postfix ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.rewrite.postfix', 'Добавить окончание')}
                onChange={(e) => updateRule(index, { transform: { ...rule.transform, postfix: e.target.value } })}
              />
            </VStack>
          </HStack>
        </VStack>
      ))}

      <Button
        type="button"
        variant="outline"
        disabled={readOnly}
        onClick={() => commit({ ...rewrite, rules: [...rules, createEmptyRewriteRule(newId())] })}
      >
        <Plus size={14} />
        <Text>{t('routes.chain.rewrite.addRule', 'Добавить правило')}</Text>
      </Button>

      {!hidePreview ? (
      <VStack gap="8" max className={styles.preview}>
        <HStack gap="4" align="center">
          <Label className={styles.label} htmlFor="rewrite-preview-input">
            {t('routes.chain.rewrite.preview', 'Проверка')}
          </Label>
          <InfoTooltip
            text={t(
              'routes.chain.rewrite.previewHint',
              'Введите пример номера: сразу видно, какое правило сработает и что уйдёт в набор.',
            )}
          />
        </HStack>
        <Input
          id="rewrite-preview-input"
          value={sample}
          disabled={readOnly}
          aria-label={t('routes.chain.rewrite.preview', 'Проверка')}
          onChange={(e) => setSample(e.target.value)}
        />
        {preview.error ? (
          <Text className={styles.previewError}>
            {t(`routes.chain.rewrite.error.${preview.error}`, preview.error)}
          </Text>
        ) : (
          <Text className={styles.previewOut}>{preview.output || '-'}</Text>
        )}
        <Text variant="muted">
          {matchedRuleN != null
            ? t('routes.chain.rewrite.matched', 'Сработало правило {{n}}').replace(
                '{{n}}',
                String(matchedRuleN),
              )
            : t('routes.chain.rewrite.matchedNone', 'Ни одно правило не подошло')}
        </Text>
      </VStack>
      ) : null}
    </VStack>
  );
}
