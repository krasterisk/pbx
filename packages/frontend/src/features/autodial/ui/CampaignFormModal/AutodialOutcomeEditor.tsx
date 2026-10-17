import { useTranslation } from 'react-i18next';
import { Button, Input, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import type { AutodialCampaignDraft } from '../../model/campaignDraft';

export function AutodialOutcomeEditor({ draft, onChange }: { draft: AutodialCampaignDraft; onChange: (draft: AutodialCampaignDraft) => void }) {
  const { t } = useTranslation();
  return <VStack gap="12" max>{draft.scenario_actions.map((step, stepIndex) => {
    if (step.type !== 'collect_input') return null;
    const entries = Object.entries((step.params.outcomeMap ?? {}) as Record<string, string>);
    const set = (next: Array<[string, string]>) => onChange({ ...draft, scenario_actions: draft.scenario_actions.map((action, index) =>
      index === stepIndex ? { ...action, params: { ...action.params, outcomeMap: Object.fromEntries(next) } } : action) });
    return <VStack gap="8" max key={step.id}>
      <Text>{t('autodial.workspace.businessOutcomes')} · {t('autodial.workspace.stepNumber', { step: stepIndex + 1 })}</Text>
      <Text variant="muted">{t('autodial.workspace.businessOutcomeHint')}</Text>
      {entries.map(([digits, outcome], index) => <HStack key={index} gap="8" wrap="wrap">
        <Input aria-label={t('autodial.workspace.inputDigits', { step: stepIndex + 1, row: index + 1 })} value={digits} maxLength={32}
          onChange={(event) => { const key = event.target.value; if (entries.some(([existing], i) => i !== index && existing === key)) return;
            set(entries.map((entry, i) => i === index ? [key, outcome] : entry)); }} />
        <Input aria-label={t('autodial.workspace.businessOutcome', { step: stepIndex + 1, row: index + 1 })} value={outcome} maxLength={64}
          onChange={(event) => set(entries.map((entry, i) => i === index ? [digits, event.target.value] : entry))} />
        <Button variant="ghost" onClick={() => set(entries.filter((_, i) => i !== index))}>{t('common.delete')}</Button>
      </HStack>)}
      <Button variant="outline" disabled={entries.length >= 10} onClick={() => {
        const next = Array.from({ length: 10 }, (_, index) => String((index + 1) % 10)).find((key) => !entries.some(([existing]) => existing === key));
        if (next) set([...entries, [next, `outcome_${next}`]]);
      }}>{t('autodial.workspace.addOutcome')}</Button>
    </VStack>;
  })}</VStack>;
}
