import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { IAutodialTrunkPoolItem } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Select,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';
import type { AutodialCampaignDraft, CampaignDraftErrors } from '../../model/campaignDraft';
import cls from './CampaignTabs.module.scss';

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
  errors: CampaignDraftErrors;
}

export const CampaignTrunksTab = memo(({ draft, onChange, errors }: Props) => {
  const { t } = useTranslation();
  const { data: trunks } = useGetTrunksQuery();

  const setPool = (trunk_pool: IAutodialTrunkPoolItem[]) => onChange({ ...draft, trunk_pool });
  const updateItem = (index: number, next: IAutodialTrunkPoolItem) =>
    setPool(draft.trunk_pool.map((item, i) => (i === index ? next : item)));

  const addTrunk = () => {
    const firstFree = (trunks ?? []).find(
      (trunk) => !draft.trunk_pool.some((item) => item.trunk_id === trunk.id),
    );
    setPool([
      ...draft.trunk_pool,
      { trunk_id: firstFree?.id ?? '', caller_id: '', weight: 1, max_channels: 0 },
    ]);
  };

  return (
    <VStack gap="16" max>
      <Text className={cls.hint}>{t('autodial.trunks.intro')}</Text>

      <VStack gap="8" max>
        {draft.trunk_pool.map((item, index) => (
          <div key={`${item.trunk_id}-${index}`} className={cls.row}>
            <div className={cls.rowGrid}>
              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-trunk-${index}`}>{t('autodial.trunks.trunk')}</Label>
                <Select
                  id={`autodial-trunk-${index}`}
                  value={item.trunk_id}
                  onChange={(e) => updateItem(index, { ...item, trunk_id: e.target.value })}
                >
                  <option value="">{t('autodial.trunks.selectTrunk')}</option>
                  {(trunks ?? []).map((trunk) => (
                    <option key={trunk.id} value={trunk.id}>
                      {trunk.name || trunk.id}
                    </option>
                  ))}
                </Select>
              </VStack>

              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-trunk-cid-${index}`}>
                  {t('autodial.trunks.callerId')}
                </Label>
                <Input
                  id={`autodial-trunk-cid-${index}`}
                  value={item.caller_id ?? ''}
                  onChange={(e) => updateItem(index, { ...item, caller_id: e.target.value })}
                />
              </VStack>

              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-trunk-weight-${index}`}>
                  {t('autodial.trunks.weight')}
                </Label>
                <Input
                  id={`autodial-trunk-weight-${index}`}
                  type="number"
                  min={1}
                  value={item.weight ?? 1}
                  onChange={(e) =>
                    updateItem(index, { ...item, weight: Number(e.target.value) || 1 })
                  }
                />
              </VStack>

              <VStack gap="4" className={cls.field}>
                <Label htmlFor={`autodial-trunk-max-${index}`}>
                  {t('autodial.trunks.maxChannels')}
                </Label>
                <Input
                  id={`autodial-trunk-max-${index}`}
                  type="number"
                  min={0}
                  value={item.max_channels ?? 0}
                  placeholder={String(
                    (trunks ?? []).find((trunk) => trunk.id === item.trunk_id)?.maxChannels || '',
                  )}
                  onChange={(e) =>
                    updateItem(index, { ...item, max_channels: Number(e.target.value) || 0 })
                  }
                />
              </VStack>

              <TableRowActions>
                <TableRowAction
                  danger
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                  onClick={() => setPool(draft.trunk_pool.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </TableRowAction>
              </TableRowActions>
            </div>
          </div>
        ))}
      </VStack>

      {errors.trunk_pool && <Text className={cls.error}>{t('autodial.trunks.atLeastOne')}</Text>}
      <Text className={cls.hint}>{t('autodial.trunks.maxChannelsHint')}</Text>

      <HStack gap="8">
        <Button variant="outline" onClick={addTrunk}>
          <Plus size={16} />
          {t('autodial.trunks.add')}
        </Button>
      </HStack>

      <VStack gap="8" max>
        <Text className={cls.sectionTitle}>{t('autodial.cid.title')}</Text>
        <HStack gap="12" align="end" wrap="wrap">
          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-cid-mode">{t('autodial.cid.mode')}</Label>
            <Select
              id="autodial-cid-mode"
              value={draft.cid_policy.mode}
              onChange={(e) =>
                onChange({
                  ...draft,
                  cid_policy: {
                    ...draft.cid_policy,
                    mode: e.target.value as AutodialCampaignDraft['cid_policy']['mode'],
                  },
                })
              }
              className={cls.narrowInput}
            >
              <option value="static">{t('autodial.cid.static')}</option>
              <option value="rotate">{t('autodial.cid.rotate')}</option>
              <option value="per_trunk">{t('autodial.cid.perTrunk')}</option>
            </Select>
          </VStack>

          {draft.cid_policy.mode === 'static' && (
            <VStack gap="4" className={cls.field}>
              <Label htmlFor="autodial-cid-value">{t('autodial.cid.value')}</Label>
              <Input
                id="autodial-cid-value"
                value={draft.cid_policy.value ?? ''}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    cid_policy: { ...draft.cid_policy, value: e.target.value },
                  })
                }
              />
            </VStack>
          )}

          {draft.cid_policy.mode === 'rotate' && (
            <VStack gap="4" className={cls.field}>
              <Label htmlFor="autodial-cid-pool">{t('autodial.cid.pool')}</Label>
              <Input
                id="autodial-cid-pool"
                value={(draft.cid_policy.pool ?? []).join(', ')}
                placeholder="74950000001, 74950000002"
                onChange={(e) =>
                  onChange({
                    ...draft,
                    cid_policy: {
                      ...draft.cid_policy,
                      pool: e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </VStack>
          )}
        </HStack>
        <Text className={cls.hint}>{t(`autodial.cid.hint.${draft.cid_policy.mode}`)}</Text>
      </VStack>
    </VStack>
  );
});

CampaignTrunksTab.displayName = 'CampaignTrunksTab';
