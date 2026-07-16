import { memo, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { ITrunkCarouselItem } from '@krasterisk/shared';
import { Button, Input, Select, Text } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import { IDialplanAppProps } from '../../../model/types';
import cls from './TrunkCarouselApp.module.scss';

type CidMode = ITrunkCarouselItem['cid_mode'];

function emptyTrunkItem(): ITrunkCarouselItem {
  return { trunk: '', cid_mode: 'static', callerid: '' };
}

function normalizeTrunks(raw: unknown): ITrunkCarouselItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = (item ?? {}) as Partial<ITrunkCarouselItem>;
    return {
      trunk: String(row.trunk ?? ''),
      cid_mode: row.cid_mode === 'phonebook' ? 'phonebook' : 'static',
      callerid: row.callerid != null ? String(row.callerid) : '',
      phonebook_uid:
        row.phonebook_uid != null && String(row.phonebook_uid) !== ''
          ? Number(row.phonebook_uid)
          : undefined,
    };
  });
}

export const TrunkCarouselApp = memo(({ action, onUpdate }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const { data: trunks = [], isLoading: trunksLoading } = useGetTrunksQuery();
  const { data: phonebooks = [], isLoading: phonebooksLoading } = useGetPhonebooksQuery();

  const items = normalizeTrunks(action.params?.trunks);

  const commitTrunks = useCallback(
    (next: ITrunkCarouselItem[]) => {
      onUpdate(action.id, 'params.trunks', next);
      if (action.params?.mode !== 'random_then_failover') {
        onUpdate(action.id, 'params.mode', 'random_then_failover');
      }
    },
    [action.id, action.params?.mode, onUpdate],
  );

  const handleAdd = useCallback(() => {
    commitTrunks([...items, emptyTrunkItem()]);
  }, [commitTrunks, items]);

  const handleRemove = useCallback(
    (index: number) => {
      commitTrunks(items.filter((_, i) => i !== index));
    },
    [commitTrunks, items],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const copy = [...items];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      commitTrunks(copy);
    },
    [commitTrunks, items],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= items.length - 1) return;
      const copy = [...items];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      commitTrunks(copy);
    },
    [commitTrunks, items],
  );

  const patchItem = useCallback(
    (index: number, patch: Partial<ITrunkCarouselItem>) => {
      commitTrunks(items.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    },
    [commitTrunks, items],
  );

  const handleTrunkChange = useCallback(
    (index: number, e: ChangeEvent<HTMLSelectElement>) => {
      patchItem(index, { trunk: e.target.value });
    },
    [patchItem],
  );

  const handleCidModeChange = useCallback(
    (index: number, e: ChangeEvent<HTMLSelectElement>) => {
      const cid_mode = e.target.value as CidMode;
      patchItem(index, { cid_mode });
    },
    [patchItem],
  );

  return (
    <div className={cls.root}>
      <div className={cls.labelRow}>
        <span>{t('routes.apps.trunkCarousel.trunks', 'Trunks')}</span>
        <InfoTooltip
          text={t(
            'routes.apps.trunkCarousel.hint',
            'Picks a random trunk first, then fails over down the ordered list on no-answer. Each trunk can set CallerID from a static number or a phonebook.',
          )}
        />
      </div>

      <div className={cls.list}>
        {items.map((item, index) => (
          <div key={`trunk-${index}`} className={cls.item}>
            <div className={cls.itemHeader}>
              <Text as="span" className={cls.itemIndex}>
                {index + 1}
              </Text>
              <Select
                className={cls.field}
                value={item.trunk}
                onChange={(e) => handleTrunkChange(index, e)}
                disabled={trunksLoading}
                aria-label={t('routes.apps.trunkCarousel.selectTrunk', 'Trunk')}
              >
                <option value="">
                  {t('routes.apps.trunkCarousel.selectTrunkOption', 'Select trunk')}
                </option>
                {trunks.map((trunk) => (
                  <option key={trunk.id} value={trunk.name}>
                    {trunk.name}
                  </option>
                ))}
              </Select>
              <Select
                className={cls.field}
                value={item.cid_mode}
                onChange={(e) => handleCidModeChange(index, e)}
                aria-label={t('routes.apps.trunkCarousel.cidMode', 'CID source')}
              >
                <option value="static">
                  {t('routes.apps.trunkCarousel.cidStatic', 'Static CID')}
                </option>
                <option value="phonebook">
                  {t('routes.apps.trunkCarousel.cidPhonebook', 'Phonebook CID')}
                </option>
              </Select>
              <div className={cls.itemActions}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMoveUp(index)}
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
                  onClick={() => handleMoveDown(index)}
                  disabled={index >= items.length - 1}
                  title={t('common.moveDown', 'Down')}
                  aria-label={t('common.moveDown', 'Down')}
                >
                  <ChevronDown size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  title={t('common.delete', 'Delete')}
                  aria-label={t('common.delete', 'Delete')}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className={cls.cidRow}>
              {item.cid_mode === 'static' ? (
                <Input
                  className={cls.field}
                  value={String(item.callerid ?? '')}
                  onChange={(e) => patchItem(index, { callerid: e.target.value })}
                  placeholder={t('routes.apps.trunkCarousel.callerid', 'CallerID number')}
                  aria-label={t('routes.apps.trunkCarousel.callerid', 'CallerID number')}
                />
              ) : (
                <Select
                  className={cls.field}
                  value={item.phonebook_uid != null ? String(item.phonebook_uid) : ''}
                  onChange={(e) =>
                    patchItem(index, {
                      phonebook_uid: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  disabled={phonebooksLoading}
                  aria-label={t(
                    'routes.apps.trunkCarousel.selectPhonebook',
                    'Select phonebook',
                  )}
                >
                  <option value="">
                    {t('routes.apps.trunkCarousel.selectPhonebook', 'Select phonebook')}
                  </option>
                  {phonebooks.map((pb) => (
                    <option key={pb.uid} value={String(pb.uid)}>
                      {pb.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className={cls.addBtn}
        onClick={handleAdd}
        aria-label={t('routes.apps.trunkCarousel.addTrunk', 'Add trunk')}
      >
        <Plus size={16} />
        {t('routes.apps.trunkCarousel.addTrunk', 'Add trunk')}
      </Button>

      <div className={cls.optionsRow}>
        <Input
          className={cls.timeout}
          type="number"
          value={action.params?.timeout ?? ''}
          onChange={(e) => onUpdate(action.id, 'params.timeout', e.target.value)}
          placeholder={t('routes.apps.common.timeout', 'Timeout, sec')}
          aria-label={t('routes.apps.common.timeout', 'Timeout, sec')}
        />
        <Input
          className={cls.options}
          value={String(action.params?.options ?? '')}
          onChange={(e) => onUpdate(action.id, 'params.options', e.target.value)}
          placeholder={t('routes.apps.common.options', 'Options (tThH)')}
          aria-label={t('routes.apps.common.options', 'Options (tThH)')}
        />
      </div>
    </div>
  );
});

TrunkCarouselApp.displayName = 'TrunkCarouselApp';
