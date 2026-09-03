import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LayoutTemplate } from 'lucide-react';
import type { ApplyTemplateMode, IRouteAction, IRouteTemplate, ITemplateSlotValue } from '@krasterisk/shared';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  RadioCards,
  SegmentedControl,
  Text,
  Tooltip,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useApplyRouteTemplateMutation,
  useGetRouteTemplatesQuery,
} from '@/shared/api/endpoints/routeTemplateApi';
import { SlotSelect } from '../SlotSelect/SlotSelect';
import { TemplateActionPreview } from '../TemplateActionPreview/TemplateActionPreview';
import styles from './ApplyTemplateDialog.module.scss';

type ApplyStep = 'choose' | 'fill' | 'mode';
type SourceFilter = 'all' | 'builtin' | 'mine';

export interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentActionCount: number;
  onApply: (actions: IRouteAction[], mode: ApplyTemplateMode) => void;
}

function isBuiltin(row: IRouteTemplate): boolean {
  return row.vpbx_user_uid == null;
}

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  currentActionCount,
  onApply,
}: ApplyTemplateDialogProps) {
  const { t } = useTranslation();
  const { data: templates = [], isLoading } = useGetRouteTemplatesQuery(undefined, { skip: !open });
  const [applyTemplate, { isLoading: isApplying }] = useApplyRouteTemplateMutation();

  const [step, setStep] = useState<ApplyStep>('choose');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [slotValues, setSlotValues] = useState<Record<string, ITemplateSlotValue>>({});
  const [mode, setMode] = useState<ApplyTemplateMode>('append');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('choose');
    setSearch('');
    setFilter('all');
    setSelectedUid(null);
    setSlotValues({});
    setMode('append');
    setConfirmReplace(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const selected = templates.find((row) => row.uid === selectedUid) ?? null;
  const slots = selected?.slots ?? [];
  const slotsFilled = slots.every((slot) => Boolean(slotValues[slot.id]?.uid));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((row) => {
      if (filter === 'builtin' && !isBuiltin(row)) return false;
      if (filter === 'mine' && isBuiltin(row)) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, search, templates]);

  const title = step === 'fill'
    ? t('routes.templates.fillTitle', 'Чем заполнить шаблон')
    : step === 'mode'
      ? t('routes.templates.applyTitle', 'Как применить шаблон')
      : t('routes.templates.chooseTitle', 'Выбор шаблона');

  const goAfterChoose = () => {
    if (!selected) return;
    if (slots.length > 0) {
      setStep('fill');
      return;
    }
    if (currentActionCount > 0) {
      setStep('mode');
      return;
    }
    void submit('append');
  };

  const goAfterFill = () => {
    if (!slotsFilled) return;
    if (currentActionCount > 0) {
      setStep('mode');
      return;
    }
    void submit('append');
  };

  const submit = async (nextMode: ApplyTemplateMode) => {
    if (!selected) return;
    setError(null);
    try {
      const result = await applyTemplate({
        uid: selected.uid,
        data: { slotValues, mode: nextMode },
      }).unwrap();
      onApply(result.actions, nextMode);
      onOpenChange(false);
    } catch {
      setError(t('routes.templates.applyError', 'Не удалось применить шаблон, действия маршрута не изменились'));
    }
  };

  const handlePrimary = () => {
    if (step === 'choose') {
      goAfterChoose();
      return;
    }
    if (step === 'fill') {
      goAfterFill();
      return;
    }
    if (mode === 'replace') {
      setConfirmReplace(true);
      return;
    }
    void submit('append');
  };

  const primaryDisabled = step === 'choose'
    ? !selected
    : step === 'fill'
      ? !slotsFilled
      : false;

  const primaryTooltip = step === 'fill' && !slotsFilled
    ? t('routes.templates.slotsIncomplete', 'Заполните все подстановки, чтобы применить')
    : undefined;

  const replaceCount = currentActionCount;
  const replaceDesc = replaceCount === 1
    ? t('routes.templates.replaceDesc_one', 'Текущее действие будет удалено, останутся только действия шаблона')
    : t('routes.templates.replaceDesc_other', 'Все {{count}} текущих действий будут удалены, останутся только действия шаблона')
      .replace('{{count}}', String(replaceCount));
  const confirmReplaceText = replaceCount === 1
    ? t('routes.templates.confirmReplace_one', 'Заменить целиком: текущее действие будет удалено. Продолжить?')
    : t('routes.templates.confirmReplace_other', 'Заменить целиком: все {{count}} текущих действий будут удалены. Продолжить?')
      .replace('{{count}}', String(replaceCount));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="large" className={styles.dialog} aria-describedby={undefined}>
          <DialogHeader className={styles.header}>
            <DialogTitle>
              <HStack gap="8" align="center">
                <LayoutTemplate size={20} />
                <Text as="span" variant="h4">{title}</Text>
              </HStack>
            </DialogTitle>
          </DialogHeader>

          <Flex className={styles.scrollBody}>
            {step === 'choose' ? (
              <VStack gap="12" max>
                <SegmentedControl
                  ariaLabel={t('routes.templates.filterAll', 'Все')}
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: t('routes.templates.filterAll', 'Все') },
                    { value: 'builtin', label: t('routes.templates.builtin', 'Встроенный') },
                    { value: 'mine', label: t('routes.templates.mine', 'Мой') },
                  ]}
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('routes.templates.searchPlaceholder', 'Поиск по названию')}
                  aria-label={t('routes.templates.searchPlaceholder', 'Поиск по названию')}
                  autoFocus
                />
                <Flex className={styles.columns}>
                  <VStack gap="8" className={styles.listPane}>
                    {isLoading ? (
                      <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
                    ) : templates.length === 0 ? (
                      <VStack gap="8">
                        <Text variant="h4">{t('routes.templates.emptyTitle', 'Шаблонов пока нет')}</Text>
                        <Text variant="muted">{t('routes.templates.emptyBody', 'Соберите цепочку в маршруте и сохраните её как шаблон, чтобы переиспользовать')}</Text>
                      </VStack>
                    ) : filtered.length === 0 ? (
                      <VStack gap="8">
                        <Text variant="h4">{t('routes.templates.searchEmptyTitle', 'Ничего не найдено')}</Text>
                        <Text variant="muted">{t('routes.templates.searchEmptyBody', 'Попробуйте другое название')}</Text>
                      </VStack>
                    ) : (
                      filtered.map((row) => (
                        <Button
                          key={row.uid}
                          type="button"
                          variant={row.uid === selectedUid ? 'default' : 'ghost'}
                          className={styles.listRow}
                          onClick={() => {
                            setSelectedUid(row.uid);
                            setSlotValues({});
                          }}
                        >
                          <VStack gap="4" align="start" max>
                            <HStack gap="8" align="center">
                              <Text>{row.name}</Text>
                              <Badge variant={isBuiltin(row) ? 'secondary' : 'outline'}>
                                {isBuiltin(row)
                                  ? t('routes.templates.builtin', 'Встроенный')
                                  : t('routes.templates.mine', 'Мой')}
                              </Badge>
                            </HStack>
                            <Text variant="muted" className={styles.meta}>
                              {t('routes.templates.actionCount', 'Действий: {{count}}').replace(
                                '{{count}}',
                                String(row.actions.length),
                              )}
                              {' · '}
                              {t('routes.templates.slotCount', 'Подстановок: {{count}}').replace(
                                '{{count}}',
                                String(row.slots.length),
                              )}
                            </Text>
                          </VStack>
                        </Button>
                      ))
                    )}
                  </VStack>
                  <VStack gap="8" className={styles.previewPane}>
                    {selected ? (
                      <TemplateActionPreview actions={selected.actions} slots={selected.slots} />
                    ) : (
                      <Text variant="muted">{t('routes.templates.previewEmpty', 'Выберите шаблон слева, чтобы увидеть его действия')}</Text>
                    )}
                  </VStack>
                </Flex>
              </VStack>
            ) : null}

            {step === 'fill' && selected ? (
              <VStack gap="16" max>
                {slots.map((slot) => (
                  <SlotSelect
                    key={slot.id}
                    slotId={slot.id}
                    kind={slot.kind}
                    label={slot.label || undefined}
                    value={slotValues[slot.id] ? String(slotValues[slot.id].uid) : ''}
                    onChange={(next) => {
                      setSlotValues((prev) => ({ ...prev, [slot.id]: next }));
                    }}
                  />
                ))}
              </VStack>
            ) : null}

            {step === 'mode' ? (
              <VStack gap="16" max>
                <RadioCards
                  ariaLabel={t('routes.templates.applyTitle', 'Как применить шаблон')}
                  value={mode}
                  onChange={(next) => setMode(next as ApplyTemplateMode)}
                  options={[
                    {
                      value: 'append',
                      label: t('routes.templates.append', 'Дописать в конец'),
                      description: t('routes.templates.appendDesc', 'Текущие действия останутся, действия шаблона встанут после них'),
                    },
                    {
                      value: 'replace',
                      label: t('routes.templates.replace', 'Заменить целиком'),
                      description: replaceDesc,
                    },
                  ]}
                />
                {mode === 'append' ? (
                  <HStack gap="8" align="start" className={styles.warning}>
                    <AlertTriangle size={16} />
                    <Text>
                      {t(
                        'routes.templates.appendOrderWarning',
                        'Проверьте порядок: если текущая цепочка уже завершается, дописанные действия не выполнятся',
                      )}
                    </Text>
                  </HStack>
                ) : null}
              </VStack>
            ) : null}

            {error ? <Text variant="error">{error}</Text> : null}
          </Flex>

          <DialogFooter className={styles.footer}>
            {step !== 'choose' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step === 'mode' && slots.length > 0 ? 'fill' : 'choose')}
              >
                {t('common.back', 'Назад')}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel', 'Отмена')}
              </Button>
            )}
            <Tooltip content={primaryTooltip}>
              <Button
                type="button"
                onClick={handlePrimary}
                disabled={primaryDisabled || isApplying}
              >
                {t('routes.templates.applyCta', 'Применить шаблон')}
              </Button>
            </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              <Text as="span" variant="h4">{t('routes.templates.replace', 'Заменить целиком')}</Text>
            </DialogTitle>
          </DialogHeader>
          <Text>{confirmReplaceText}</Text>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmReplace(false)}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmReplace(false);
                void submit('replace');
              }}
            >
              {t('common.confirm', 'Подтвердить')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
