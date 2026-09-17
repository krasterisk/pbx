import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Label, MultiSelect, Select, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetAutodialBasesQuery } from '@/shared/api/endpoints/autodialApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import type { AutodialCampaignDraft, CampaignDraftErrors } from '../../model/campaignDraft';
import cls from './CampaignTabs.module.scss';

interface Props {
  draft: AutodialCampaignDraft;
  onChange: (next: AutodialCampaignDraft) => void;
  errors: CampaignDraftErrors;
  dialModeOptions: Array<{ value: string; label: string }>;
}

export const CampaignGeneralTab = memo(
  ({ draft, onChange, errors, dialModeOptions }: Props) => {
    const { t } = useTranslation();
    const { data: bases } = useGetAutodialBasesQuery();
    const { data: queues } = useGetQueuesQuery();

    const patch = (part: Partial<AutodialCampaignDraft>) => onChange({ ...draft, ...part });

    return (
      <VStack gap="16" max>
        <div className={cls.grid}>
          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-campaign-name">{t('autodial.form.name')}</Label>
            <Input
              id="autodial-campaign-name"
              value={draft.name}
              aria-invalid={Boolean(errors.name) || undefined}
              onChange={(e) => patch({ name: e.target.value })}
            />
            {errors.name && <Text className={cls.error}>{t('common.fieldRequired')}</Text>}
          </VStack>

          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-campaign-base">{t('autodial.form.base')}</Label>
            <Select
              id="autodial-campaign-base"
              value={draft.base_uid ?? ''}
              error={Boolean(errors.base_uid)}
              onChange={(e) => patch({ base_uid: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">{t('autodial.form.basePlaceholder')}</option>
              {(bases ?? []).map((base) => (
                <option key={base.uid} value={base.uid}>
                  {base.name}
                </option>
              ))}
            </Select>
            {errors.base_uid && <Text className={cls.error}>{t('common.fieldRequired')}</Text>}
          </VStack>

          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-campaign-mode">{t('autodial.form.dialMode')}</Label>
            <Select
              id="autodial-campaign-mode"
              value={draft.dial_mode}
              onChange={(e) =>
                patch({ dial_mode: e.target.value as AutodialCampaignDraft['dial_mode'] })
              }
            >
              {dialModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Text className={cls.hint}>{t(`autodial.form.dialModeHint.${draft.dial_mode}`)}</Text>
          </VStack>

          <VStack gap="4" className={cls.field}>
            <Label>{t('autodial.form.queues')}</Label>
            <MultiSelect
              options={(queues ?? []).map((queue) => ({
                value: queue.name,
                label: queue.name,
              }))}
              value={draft.queue_names}
              onChange={(queue_names) => patch({ queue_names })}
              placeholder={t('autodial.form.queuesPlaceholder')}
            />
            {errors.queue_names ? (
              <Text className={cls.error}>{t('autodial.form.queuesRequired')}</Text>
            ) : (
              <Text className={cls.hint}>{t('autodial.form.queuesHint')}</Text>
            )}
          </VStack>

          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-campaign-success">{t('autodial.form.successMinSec')}</Label>
            <Input
              id="autodial-campaign-success"
              type="number"
              min={0}
              className={cls.narrowInput}
              value={draft.success_min_sec}
              onChange={(e) => patch({ success_min_sec: Number(e.target.value) || 0 })}
            />
            <Text className={cls.hint}>{t('autodial.form.successMinSecHint')}</Text>
          </VStack>

          <VStack gap="4" className={cls.field}>
            <Label htmlFor="autodial-campaign-timeout">{t('autodial.form.dialTimeout')}</Label>
            <Input
              id="autodial-campaign-timeout"
              type="number"
              min={5}
              className={cls.narrowInput}
              value={draft.dial_timeout_sec}
              onChange={(e) => patch({ dial_timeout_sec: Number(e.target.value) || 0 })}
            />
            <Text className={cls.hint}>{t('autodial.form.dialTimeoutHint')}</Text>
          </VStack>
        </div>
      </VStack>
    );
  },
);

CampaignGeneralTab.displayName = 'CampaignGeneralTab';
