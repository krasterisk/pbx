import { useTranslation } from 'react-i18next';
import { AUTODIAL_GOAL_RELATIONS, AUTODIAL_OUTCOME_CATEGORIES, type AutodialOutcomeDefinition } from '@krasterisk/shared';
import { Button, Input, Label, Select, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import type { AutodialCampaignDraft } from '../../model/campaignDraft';
import cls from './CampaignTabs.module.scss';
import { ConnectionOutcomeEditor } from './ConnectionOutcomeEditor';

export function AutodialOutcomeEditor({ draft, onChange }: { draft: AutodialCampaignDraft; onChange: (draft: AutodialCampaignDraft) => void }) {
  const { t } = useTranslation();
  const codeLocked = (draft.revision ?? 0) > 0;
  return <VStack gap="12" max>{draft.scenario_actions.map((step, stepIndex) => {
    if (step.type === 'toqueue') return <ConnectionOutcomeEditor key={step.id} step={stepIndex + 1} value={step.params.connectionOutcome}
      onChange={(connectionOutcome) => onChange({ ...draft, scenario_actions: draft.scenario_actions.map((action, index) => index === stepIndex
        ? { ...action, params: { ...action.params, connectionOutcome } } : action) })} />;
    if (step.type !== 'collect_input') return null;
    const entries = Object.entries((step.params.outcomeMap ?? {}) as Record<string, string>);
    const definitions = (step.params.outcomeDefinitions ?? {}) as Record<string, AutodialOutcomeDefinition>;
    const set = (next: Array<[string, string]>, metadata = definitions) => {
      const codes = new Set(next.map(([, code]) => code));
      onChange({ ...draft, scenario_actions: draft.scenario_actions.map((action, index) => index === stepIndex
        ? { ...action, params: { ...action.params, outcomeMap: Object.fromEntries(next),
          outcomeDefinitions: Object.fromEntries(Object.entries(metadata).filter(([code]) => codes.has(code))) } } : action) });
    };
    return <VStack gap="8" max key={step.id}>
      <Text>{t('autodial.workspace.businessOutcomes')} · {t('autodial.workspace.stepNumber', { step: stepIndex + 1 })}</Text>
      <Text variant="muted">{t('autodial.workspace.outcomeDefinition.hint')}</Text>
      {entries.map(([digits, outcome], index) => {
        const definition = definitions[outcome] ?? { label: outcome, category: 'neutral', goal_relation: 'unknown' };
        const prefix = `ac-outcome-${step.id}-${index}`;
        const change = (patch: Partial<AutodialOutcomeDefinition>) => set(entries, { ...definitions, [outcome]: { ...definition, ...patch } });
        return <VStack gap="8" max className={cls.outcomeRow} key={index}>
          <HStack gap="8" wrap="wrap" max>
            <VStack gap="4"><Label htmlFor={`${prefix}-digits`}>{t('autodial.workspace.inputDigits', { step: stepIndex + 1, row: index + 1 })}</Label>
              <Input id={`${prefix}-digits`} value={digits} maxLength={32} onChange={(event) => {
                const key = event.target.value;
                if (!entries.some(([existing], at) => at !== index && existing === key)) set(entries.map((entry, at) => at === index ? [key, outcome] : entry));
              }} /></VStack>
            <VStack gap="4"><Label htmlFor={`${prefix}-label`}>{t('autodial.workspace.outcomeDefinition.label')}</Label>
              <Input id={`${prefix}-label`} value={definition.label} maxLength={120} onChange={(event) => change({ label: event.target.value })} /></VStack>
            <Button variant="ghost" onClick={() => set(entries.filter((_, at) => at !== index))}>{t('common.delete')}</Button>
          </HStack>
          <HStack gap="8" wrap="wrap" max>
            <VStack gap="4"><Label htmlFor={`${prefix}-category`}>{t('autodial.workspace.outcomeDefinition.category')}</Label>
              <Select id={`${prefix}-category`} value={definition.category} onChange={(event) => change({ category: event.target.value as AutodialOutcomeDefinition['category'] })}>
                {AUTODIAL_OUTCOME_CATEGORIES.map((value) => <option key={value} value={value}>{t(`autodial.workspace.outcomeDefinition.categories.${value}`)}</option>)}
              </Select></VStack>
            <VStack gap="4"><Label htmlFor={`${prefix}-goal`}>{t('autodial.workspace.outcomeDefinition.goal')}</Label>
              <Select id={`${prefix}-goal`} value={definition.goal_relation} onChange={(event) => change({ goal_relation: event.target.value as AutodialOutcomeDefinition['goal_relation'] })}>
                {AUTODIAL_GOAL_RELATIONS.map((value) => <option key={value} value={value}>{t(`autodial.workspace.outcomeDefinition.relations.${value}`)}</option>)}
              </Select></VStack>
          </HStack>
          <details><summary>{t('autodial.workspace.outcomeDefinition.code')}</summary>
            <Input aria-label={t('autodial.workspace.businessOutcome', { step: stepIndex + 1, row: index + 1 })} value={outcome} readOnly={codeLocked} maxLength={64}
              onChange={(event) => {
                if (codeLocked) return;
                const code = event.target.value;
                const metadata = { ...definitions, ...(definitions[outcome] ? { [code]: definitions[outcome] } : {}) };
                set(entries.map((entry, at) => at === index ? [digits, code] : entry), metadata);
              }} />
            {codeLocked && <Text variant="muted">{t('autodial.workspace.outcomeDefinition.codeLocked')}</Text>}
          </details>
        </VStack>;
      })}
      <Button variant="outline" disabled={entries.length >= 10} onClick={() => {
        const next = Array.from({ length: 10 }, (_, index) => String((index + 1) % 10)).find((key) => !entries.some(([existing]) => existing === key));
        if (next) {
          const code = `outcome_${stepIndex + 1}_${next}`;
          set([...entries, [next, code]], { ...definitions, [code]: { label: t('autodial.workspace.outcomeDefinition.newLabel', { number: next }), category: 'neutral', goal_relation: 'unknown' } });
        }
      }}>{t('autodial.workspace.addOutcome')}</Button>
    </VStack>;
  })}</VStack>;
}
