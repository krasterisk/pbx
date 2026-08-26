import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DialRewriteCharset,
  DialRewriteTransform,
  DialTargetRewrite,
  ValueSource,
} from '@krasterisk/shared';
import { coerceDialTargetRewrite, evaluateDialTargetRewrite, rewriteHasWork } from '@krasterisk/shared';
import { Input, Label, Switch, Text, InfoTooltip, Button } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import { AppCollapsibleSection } from '../AppCollapsibleSection/AppCollapsibleSection';
import { DialTargetRewriteEditor } from '../DialTargetRewriteEditor/DialTargetRewriteEditor';
import type { SchemaFieldRenderCtx } from '../../model/schema.types';
import { DEFAULT_PHONE_MIN_LENGTH, resolveDialPreviewOptions } from './dialPreviewSample';
import styles from './DialModifyField.module.scss';

const EMPTY_PHONEBOOKS: never[] = [];
const BASIC_RULE_ID = 'basic';

/** Transform fields exposed in the simple UI (Asterisk-variable-like edits). */
type BasicTransform = Pick<
  DialRewriteTransform,
  'stripStartCount' | 'stripEndCount' | 'prefix' | 'postfix'
>;

function asRewrite(raw: unknown): DialTargetRewrite {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as DialTargetRewrite).rules)
  ) {
    return raw as DialTargetRewrite;
  }
  return { noMatch: 'passthrough', rules: [] };
}

function firstTransform(rw: DialTargetRewrite): DialRewriteTransform {
  return rw.rules?.[0]?.transform ?? {};
}

function hasBasicWork(t: BasicTransform): boolean {
  return Boolean(t.stripStartCount || t.stripEndCount || t.prefix || t.postfix);
}

/** Only strip-count + prefix/postfix, one unconditional rule, keep-original policy. */
function isBasicShape(rw: DialTargetRewrite): boolean {
  const rules = rw.rules ?? [];
  if (rw.noMatch === 'reject') return false;
  if (rules.length === 0) return true;
  if (rules.length > 1) return false;
  const rule = rules[0];
  if ((rule.conditions?.length ?? 0) > 0) return false;
  const t = rule.transform ?? {};
  return (
    !t.replaceAll &&
    !t.stripStartText &&
    !t.stripEndText &&
    !t.replaceFind &&
    !t.replaceWith
  );
}

function buildBasicRewrite(t: BasicTransform): DialTargetRewrite | undefined {
  if (!hasBasicWork(t)) return undefined;
  return {
    noMatch: 'passthrough',
    rules: [{ id: BASIC_RULE_ID, enabled: true, conditions: [], transform: { ...t } }],
  };
}

function sourceKind(source: ValueSource | string | number | undefined): string {
  if (source && typeof source === 'object' && 'source' in source) return source.source;
  if (typeof source === 'string' || typeof source === 'number') return 'fixed';
  return 'route_pattern';
}

export interface DialModifyFieldProps {
  rewrite?: DialTargetRewrite | unknown;
  onRewriteChange: (next: DialTargetRewrite | undefined) => void;
  /** Destination ValueSource — drives interactive preview samples. */
  source?: ValueSource | string | number;
  /** Current route extensions / patterns (for `route_pattern` destination). */
  previewPatterns?: string[];
  charset?: DialRewriteCharset;
  tenantUid?: number;
  readOnly?: boolean;
}

/**
 * Basic-first number modification: prefix / postfix / trim digits with a live
 * preview. Advanced first-match rules are tucked behind an "expert mode" switch.
 */
export function DialModifyField({
  rewrite: rewriteProp,
  onRewriteChange,
  source,
  previewPatterns,
  charset = 'phone',
  tenantUid = 0,
  readOnly,
}: DialModifyFieldProps) {
  const { t } = useTranslation();
  const rewrite = asRewrite(rewriteProp);
  const basicShape = isBasicShape(rewrite);
  const [expert, setExpert] = useState(!basicShape);
  const [open, setOpen] = useState(() => rewriteHasWork(rewrite));

  const needsPhonebooks = sourceKind(source) === 'phonebook';
  const { data: phonebooksData } = useGetPhonebooksQuery(undefined, { skip: !needsPhonebooks });
  const phonebooks = phonebooksData ?? EMPTY_PHONEBOOKS;

  const options = useMemo(
    () =>
      resolveDialPreviewOptions(source, {
        routePatterns: previewPatterns,
        phonebooks,
        fallback: charset === 'exten' ? '1001' : '79001234567',
        // Trunks dial external numbers — short route extens (e.g. 201) make a poor rewrite demo.
        minLength: charset === 'phone' ? DEFAULT_PHONE_MIN_LENGTH : undefined,
      }),
    [source, previewPatterns, phonebooks, charset],
  );

  const [pickedValue, setPickedValue] = useState(options[0]?.value ?? '');
  const [manualMode, setManualMode] = useState(false);
  const [manualSample, setManualSample] = useState(options[0]?.value ?? '');

  const optionsKey = options.map((o) => o.value).join('|');

  // Keep selection in sync when destination / route patterns change.
  useEffect(() => {
    const next = options[0]?.value ?? '';
    setPickedValue((prev) => (options.some((o) => o.value === prev) ? prev : next));
    setManualMode(false);
    setManualSample(next);
    // optionsKey captures identity; options is read for the current values.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when sample set changes
  }, [optionsKey]);

  const sample = manualMode ? manualSample : pickedValue;
  const activeOption = options.find((o) => o.value === pickedValue) ?? options[0];
  const lockedExact = Boolean(activeOption?.exact) && options.length === 1 && !manualMode;

  const transform = firstTransform(rewrite);
  const basic: BasicTransform = {
    stripStartCount: transform.stripStartCount,
    stripEndCount: transform.stripEndCount,
    prefix: transform.prefix,
    postfix: transform.postfix,
  };

  const preview = useMemo(
    () => evaluateDialTargetRewrite(sample, rewrite, charset),
    [sample, rewrite, charset],
  );

  const matchedRuleN = useMemo(() => {
    if (!preview.matchedRuleId) return null;
    const rules = rewrite.rules ?? [];
    const idx = rules.findIndex((rule) => rule.id === preview.matchedRuleId);
    return idx >= 0 ? idx + 1 : null;
  }, [preview.matchedRuleId, rewrite.rules]);

  const setBasic = (patch: Partial<BasicTransform>) => {
    onRewriteChange(buildBasicRewrite({ ...basic, ...patch }));
  };

  const toggleExpert = (checked: boolean) => {
    if (checked) {
      setExpert(true);
      return;
    }
    onRewriteChange(buildBasicRewrite(basic));
    setExpert(false);
  };

  const numberValue = (v: number | undefined) => (v == null ? '' : String(v));
  const toCount = (raw: string) => (raw === '' ? undefined : Math.max(0, Number(raw) || 0));

  return (
    <AppCollapsibleSection
      title={t('routes.chain.modify.title', 'Модификация номера')}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      tooltip={t(
        'routes.chain.modify.sectionHint',
        '**Необязательно** - префикс, обрезка цифр или экспертные правила',
      )}
    >
      <VStack gap="12" max className={styles.root}>
      {!expert ? (
        <VStack gap="12" max className={styles.card}>
          <HStack gap="8" max wrap="wrap" className={styles.fieldRow}>
            <VStack gap="4" max className={styles.fieldHalf}>
              <Label className={styles.label} htmlFor="dial-modify-prefix">
                {t('routes.chain.modify.prefix', 'Добавить в начало')}
              </Label>
              <Input
                id="dial-modify-prefix"
                className={styles.narrow}
                value={basic.prefix ?? ''}
                disabled={readOnly}
                placeholder="8"
                aria-label={t('routes.chain.modify.prefix', 'Добавить в начало')}
                onChange={(e) => setBasic({ prefix: e.target.value || undefined })}
              />
            </VStack>
            <VStack gap="4" max className={styles.fieldHalf}>
              <Label className={styles.label} htmlFor="dial-modify-postfix">
                {t('routes.chain.modify.postfix', 'Добавить в конец')}
              </Label>
              <Input
                id="dial-modify-postfix"
                className={styles.narrow}
                value={basic.postfix ?? ''}
                disabled={readOnly}
                aria-label={t('routes.chain.modify.postfix', 'Добавить в конец')}
                onChange={(e) => setBasic({ postfix: e.target.value || undefined })}
              />
            </VStack>
          </HStack>

          <HStack gap="8" max wrap="wrap" className={styles.fieldRow}>
            <VStack gap="4" max className={styles.fieldHalf}>
              <Label className={styles.label} htmlFor="dial-modify-strip-start">
                {t('routes.chain.modify.stripStart', 'Убрать цифр в начале')}
              </Label>
              <Input
                id="dial-modify-strip-start"
                className={styles.narrow}
                type="number"
                inputMode="numeric"
                min={0}
                value={numberValue(basic.stripStartCount)}
                disabled={readOnly}
                placeholder="0"
                aria-label={t('routes.chain.modify.stripStart', 'Убрать цифр в начале')}
                onChange={(e) => setBasic({ stripStartCount: toCount(e.target.value) })}
              />
            </VStack>
            <VStack gap="4" max className={styles.fieldHalf}>
              <Label className={styles.label} htmlFor="dial-modify-strip-end">
                {t('routes.chain.modify.stripEnd', 'Убрать цифр в конце')}
              </Label>
              <Input
                id="dial-modify-strip-end"
                className={styles.narrow}
                type="number"
                inputMode="numeric"
                min={0}
                value={numberValue(basic.stripEndCount)}
                disabled={readOnly}
                placeholder="0"
                aria-label={t('routes.chain.modify.stripEnd', 'Убрать цифр в конце')}
                onChange={(e) => setBasic({ stripEndCount: toCount(e.target.value) })}
              />
            </VStack>
          </HStack>
        </VStack>
      ) : (
        <DialTargetRewriteEditor
          rewrite={rewrite}
          onRewriteChange={onRewriteChange}
          charset={charset}
          tenantUid={tenantUid}
          readOnly={readOnly}
          hidePreview
        />
      )}

      <VStack gap="8" max className={styles.preview}>
        <HStack gap="4" align="center" justify="between" max wrap="wrap">
          <HStack gap="4" align="center">
            <Label className={styles.label}>
              {t('routes.chain.modify.preview', 'Что уйдёт в набор')}
            </Label>
            <InfoTooltip
              text={t(
                'routes.chain.modify.previewHint',
                '**Фиксированный номер** - берётся из назначения\n**Маска маршрута** - пример из расширений маршрута\n**Справочник** - значение поля из записи\nМожно выбрать другой пример или задать свой',
              )}
            />
          </HStack>
          {!lockedExact && !manualMode ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={() => {
                setManualMode(true);
                setManualSample(sample);
              }}
            >
              {t('routes.chain.modify.customSample', 'Свой пример')}
            </Button>
          ) : null}
          {manualMode ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={() => setManualMode(false)}
            >
              {t('routes.chain.modify.autoSample', 'Авто')}
            </Button>
          ) : null}
        </HStack>

        {options.length > 1 && !manualMode ? (
          <HStack
            gap="4"
            wrap="wrap"
            max
            className={styles.chips}
            role="listbox"
            aria-label={t('routes.chain.modify.samples', 'Примеры')}
          >
            {options.map((opt) => (
              <Button
                key={`${opt.label}-${opt.value}`}
                type="button"
                variant={opt.value === pickedValue ? 'secondary' : 'outline'}
                size="sm"
                role="option"
                aria-selected={opt.value === pickedValue}
                className={styles.chip}
                disabled={readOnly}
                onClick={() => setPickedValue(opt.value)}
              >
                <Text variant="small">{opt.label}</Text>
              </Button>
            ))}
          </HStack>
        ) : null}

        {manualMode ? (
          <Input
            id="dial-modify-preview"
            value={manualSample}
            disabled={readOnly}
            aria-label={t('routes.chain.modify.sample', 'Пример номера')}
            onChange={(e) => setManualSample(e.target.value)}
          />
        ) : (
          <Text variant="muted" className={styles.sampleMeta}>
            {activeOption?.exact
              ? t('routes.chain.modify.fromSource', 'Из назначения: {{label}}').replace(
                  '{{label}}',
                  activeOption.label,
                )
              : t('routes.chain.modify.fromPattern', 'Пример B-номера: {{label}}').replace(
                  '{{label}}',
                  activeOption?.label ?? sample,
                )}
          </Text>
        )}

        <HStack gap="8" align="center" className={styles.previewRow}>
          <Text variant="small" className={styles.previewFrom}>
            {sample || '-'}
          </Text>
          <Text variant="small" className={styles.previewArrow}>
            →
          </Text>
          {preview.error ? (
            <Text variant="small" className={styles.previewError}>
              {t(`routes.chain.rewrite.error.${preview.error}`, preview.error)}
            </Text>
          ) : (
            <Text variant="small" className={styles.previewOut}>
              {preview.output || '-'}
            </Text>
          )}
        </HStack>
        {expert ? (
          <Text variant="muted">
            {matchedRuleN != null
              ? t('routes.chain.rewrite.matched', 'Сработало правило {{n}}').replace(
                  '{{n}}',
                  String(matchedRuleN),
                )
              : t('routes.chain.rewrite.matchedNone', 'Ни одно правило не подошло')}
          </Text>
        ) : null}
      </VStack>

      <HStack gap="8" align="center" max justify="between" wrap="wrap" className={styles.expertHeader}>
        <HStack gap="4" align="center">
          <Label className={styles.label} htmlFor="dial-modify-expert">
            {t('routes.chain.modify.expert', 'Экспертный режим')}
          </Label>
          <InfoTooltip
            text={t(
              'routes.chain.modify.expertHint',
              '**Условия** - когда правило применимо\n**Несколько правил** - срабатывает первое подходящее\nНужно редко',
            )}
          />
        </HStack>
        <Switch
          id="dial-modify-expert"
          checked={expert}
          disabled={readOnly}
          aria-label={t('routes.chain.modify.expert', 'Экспертный режим')}
          onCheckedChange={toggleExpert}
        />
      </HStack>
      </VStack>
    </AppCollapsibleSection>
  );
}

/** Registry helper: modification field that seeds preview from `sourceKey`. */
export function makeDialModifyRenderer(
  sourceKey: string | undefined,
  charset: DialRewriteCharset,
) {
  return function renderDialModify(ctx: SchemaFieldRenderCtx) {
    const source = sourceKey
      ? (ctx.params[sourceKey] as ValueSource | string | number | undefined)
      : undefined;
    return (
      <DialModifyField
        rewrite={coerceDialTargetRewrite(ctx.params) ?? ctx.params.rewrite}
        onRewriteChange={(rewrite) =>
          ctx.onChange({ rewrite, strip: undefined, prepend: undefined, numberManipulation: undefined })
        }
        source={source}
        previewPatterns={ctx.previewPatterns}
        charset={charset}
        tenantUid={ctx.tenantUid}
        readOnly={ctx.readOnly}
      />
    );
  };
}

export const renderDialModifyDest = makeDialModifyRenderer('dest', 'phone');
export const renderDialModifyTarget = makeDialModifyRenderer('target', 'exten');
export const renderDialModifyExtension = makeDialModifyRenderer('extension', 'exten');
export const renderDialModifyNone = makeDialModifyRenderer(undefined, 'phone');
