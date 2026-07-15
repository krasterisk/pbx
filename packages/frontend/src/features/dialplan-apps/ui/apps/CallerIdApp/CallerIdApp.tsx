import { memo, useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { CallerIdMode } from '@krasterisk/shared';
import { Button, Input, Select, Text } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import { IDialplanAppProps } from '../../../model/types';
import cls from './CallerIdApp.module.scss';

const CALLER_ID_MODES: CallerIdMode[] = ['static', 'phonebook', 'setclid_list', 'carousel'];

const MODE_LABEL_KEYS: Record<CallerIdMode, string> = {
  static: 'routes.apps.callerid.modeStatic',
  phonebook: 'routes.apps.callerid.modePhonebook',
  setclid_list: 'routes.apps.callerid.modeSetclidList',
  carousel: 'routes.apps.callerid.modeCarousel',
};

const MODE_HINT_KEYS: Record<CallerIdMode, string> = {
  static: 'routes.apps.callerid.hintStatic',
  phonebook: 'routes.apps.callerid.hintPhonebook',
  setclid_list: 'routes.apps.callerid.hintSetclidList',
  carousel: 'routes.apps.callerid.hintCarousel',
};

const MODE_HINT_FALLBACKS: Record<CallerIdMode, string> = {
  static: 'Sets CALLERID(num) and optional CALLERID(name) to fixed values.',
  phonebook: 'Looks up CallerID in the selected phonebook and applies matched variables.',
  setclid_list: 'Picks CallerID from a legacy setclid list via exten_setclid.php.',
  carousel:
    'Randomly selects one number from the ordered pool (${CID_${RAND(1,N)}}). Does not dial or fail over — use Trunk Carousel for retry/failover.',
};

function isCallerIdMode(value: unknown): value is CallerIdMode {
  return typeof value === 'string' && (CALLER_ID_MODES as string[]).includes(value);
}

/** Infer mode for legacy setclid_* records and partial callerid params. */
export function resolveCallerIdMode(
  actionType: string,
  params: Record<string, unknown> | undefined,
): CallerIdMode {
  if (params && isCallerIdMode(params.mode)) {
    return params.mode;
  }
  if (actionType === 'setclid_list') return 'setclid_list';
  if (actionType === 'setclid_custom') return 'static';
  if (Array.isArray(params?.pool) && params.pool.length > 0) return 'carousel';
  if (params?.phonebook_uid != null && params.phonebook_uid !== '') return 'phonebook';
  if (params?.list_uid != null && params.list_uid !== '') return 'setclid_list';
  return 'static';
}

export const CallerIdApp = memo(({ action, onUpdate }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const { data: phonebooks = [], isLoading: phonebooksLoading } = useGetPhonebooksQuery();
  const [pendingNumber, setPendingNumber] = useState('');

  const mode = resolveCallerIdMode(action.type, action.params);
  const pool: string[] = Array.isArray(action.params?.pool)
    ? action.params.pool.map((n: unknown) => String(n ?? ''))
    : [];

  const modeOptions = useMemo(
    () =>
      CALLER_ID_MODES.map((m) => ({
        value: m,
        label: t(MODE_LABEL_KEYS[m], m),
      })),
    [t],
  );

  const handleModeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as CallerIdMode;
      onUpdate(action.id, 'params.mode', next);
    },
    [action.id, onUpdate],
  );

  const updatePool = useCallback(
    (next: string[]) => {
      onUpdate(action.id, 'params.pool', next);
    },
    [action.id, onUpdate],
  );

  const handleAddPoolNumber = useCallback(() => {
    const value = pendingNumber.trim();
    if (!value) return;
    updatePool([...pool, value]);
    setPendingNumber('');
  }, [pendingNumber, pool, updatePool]);

  const handlePoolMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const copy = [...pool];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      updatePool(copy);
    },
    [pool, updatePool],
  );

  const handlePoolMoveDown = useCallback(
    (index: number) => {
      if (index >= pool.length - 1) return;
      const copy = [...pool];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      updatePool(copy);
    },
    [pool, updatePool],
  );

  const handlePoolRemove = useCallback(
    (index: number) => {
      updatePool(pool.filter((_, i) => i !== index));
    },
    [pool, updatePool],
  );

  const handlePoolEdit = useCallback(
    (index: number, value: string) => {
      const copy = [...pool];
      copy[index] = value;
      updatePool(copy);
    },
    [pool, updatePool],
  );

  return (
    <div className={cls.root}>
      <div className={cls.row}>
        <Select
          className={cls.modeSelect}
          value={mode}
          onChange={handleModeChange}
          aria-label={t('routes.apps.callerid.mode', 'CallerID mode')}
        >
          {modeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className={cls.hint}>
        <Text variant="small">{t(MODE_HINT_KEYS[mode], MODE_HINT_FALLBACKS[mode])}</Text>
        <InfoTooltip text={t(MODE_HINT_KEYS[mode], MODE_HINT_FALLBACKS[mode])} />
      </div>

      {mode === 'static' && (
        <div className={cls.row}>
          <Input
            className={cls.field}
            value={String(action.params?.callerid ?? '')}
            onChange={(e) => onUpdate(action.id, 'params.callerid', e.target.value)}
            placeholder={t('routes.apps.callerid.callerid', 'CallerID number')}
            aria-label={t('routes.apps.callerid.callerid', 'CallerID number')}
          />
          <Input
            className={cls.field}
            value={String(action.params?.name ?? '')}
            onChange={(e) => onUpdate(action.id, 'params.name', e.target.value)}
            placeholder={t('routes.apps.callerid.name', 'CallerID name (optional)')}
            aria-label={t('routes.apps.callerid.name', 'CallerID name (optional)')}
          />
        </div>
      )}

      {mode === 'phonebook' && (
        <div className={cls.row}>
          <Select
            className={cls.field}
            value={String(action.params?.phonebook_uid ?? '')}
            onChange={(e) => onUpdate(action.id, 'params.phonebook_uid', e.target.value)}
            disabled={phonebooksLoading}
            aria-label={t('routes.apps.callerid.selectPhonebook', 'Select phonebook')}
          >
            <option value="">
              {t('routes.apps.callerid.selectPhonebook', 'Select phonebook')}
            </option>
            {phonebooks.map((pb) => (
              <option key={pb.uid} value={String(pb.uid)}>
                {pb.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {mode === 'setclid_list' && (
        <div className={cls.row}>
          <Input
            className={cls.field}
            value={String(action.params?.list_uid ?? '')}
            onChange={(e) => onUpdate(action.id, 'params.list_uid', e.target.value)}
            placeholder={t('routes.apps.callerid.listUid', 'List ID')}
            aria-label={t('routes.apps.callerid.listUid', 'List ID')}
          />
        </div>
      )}

      {mode === 'carousel' && (
        <div className={cls.pool}>
          {pool.map((number, index) => (
            <div key={`pool-${index}`} className={cls.poolItem}>
              <Text as="span" className={cls.poolIndex}>
                {index + 1}
              </Text>
              <Input
                className={cls.poolInput}
                value={number}
                onChange={(e) => handlePoolEdit(index, e.target.value)}
                aria-label={t('routes.apps.callerid.poolNumber', 'Pool number')}
              />
              <div className={cls.poolActions}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePoolMoveUp(index)}
                  disabled={index === 0}
                  title={t('common.moveUp', 'Up')}
                  aria-label={t('common.moveUp', 'Up')}
                >
                  <ChevronUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePoolMoveDown(index)}
                  disabled={index >= pool.length - 1}
                  title={t('common.moveDown', 'Down')}
                  aria-label={t('common.moveDown', 'Down')}
                >
                  <ChevronDown size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePoolRemove(index)}
                  title={t('common.delete', 'Delete')}
                  aria-label={t('common.delete', 'Delete')}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}

          <div className={cls.addRow}>
            <Input
              className={cls.addInput}
              value={pendingNumber}
              onChange={(e) => setPendingNumber(e.target.value)}
              placeholder={t('routes.apps.callerid.addNumber', 'Add number to pool')}
              aria-label={t('routes.apps.callerid.addNumber', 'Add number to pool')}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPoolNumber}
              disabled={!pendingNumber.trim()}
              aria-label={t('routes.apps.callerid.addToPool', 'Add')}
            >
              <Plus size={16} />
              {t('routes.apps.callerid.addToPool', 'Add')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

CallerIdApp.displayName = 'CallerIdApp';
