import { useTranslation } from 'react-i18next';
import { AUTODIAL_GOAL_RELATIONS, AUTODIAL_OUTCOME_CATEGORIES, autodialCompletionOutcomeSchema,
  type AutodialOutcomeDefinition } from '@krasterisk/shared';
import { Button, Input, Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';

type ConnectionOutcome = AutodialOutcomeDefinition & { code: string };

export function ConnectionOutcomeEditor({ value, step, onChange }: {
  value: unknown; step: number; onChange: (value: ConnectionOutcome | undefined) => void;
}) {
  const { t } = useTranslation(), parsed = autodialCompletionOutcomeSchema.safeParse(value);
  const outcome = parsed.success ? parsed.data : null, prefix = `ac-connection-${step}`;
  const change = (patch: Partial<AutodialOutcomeDefinition>) => { if (outcome) onChange({ ...outcome, ...patch }); };
  return <VStack gap="8" max>
    <Text>{t('autodial.workspace.operatorConnection.title')} · {t('autodial.workspace.stepNumber', { step })}</Text>
    <Text variant="muted">{t('autodial.workspace.operatorConnection.hint')}</Text>
    {!outcome ? <Button variant="outline" onClick={() => onChange({ code: 'operator_connected',
      label: t('autodial.workspace.library.outcomes.operator_connected'), category: 'positive', goal_relation: 'achieved' })}>
      {t('autodial.workspace.operatorConnection.enable')}
    </Button> : <>
      <Label htmlFor={`${prefix}-label`}>{t('autodial.workspace.outcomeDefinition.label')}</Label>
      <Input id={`${prefix}-label`} maxLength={120} value={outcome.label} onChange={(event) => change({ label: event.target.value })} />
      <HStack gap="12" wrap="wrap">
        <VStack gap="4"><Label htmlFor={`${prefix}-category`}>{t('autodial.workspace.outcomeDefinition.category')}</Label>
          <Select id={`${prefix}-category`} value={outcome.category} onChange={(event) => change({ category: event.target.value as AutodialOutcomeDefinition['category'] })}>
            {AUTODIAL_OUTCOME_CATEGORIES.map((item) => <option key={item} value={item}>{t(`autodial.workspace.outcomeDefinition.categories.${item}`)}</option>)}
          </Select></VStack>
        <VStack gap="4"><Label htmlFor={`${prefix}-goal`}>{t('autodial.workspace.outcomeDefinition.goal')}</Label>
          <Select id={`${prefix}-goal`} value={outcome.goal_relation} onChange={(event) => change({ goal_relation: event.target.value as AutodialOutcomeDefinition['goal_relation'] })}>
            {AUTODIAL_GOAL_RELATIONS.map((item) => <option key={item} value={item}>{t(`autodial.workspace.outcomeDefinition.relations.${item}`)}</option>)}
          </Select></VStack>
      </HStack>
      <Button variant="ghost" onClick={() => onChange(undefined)}>{t('autodial.workspace.operatorConnection.disable')}</Button>
    </>}
  </VStack>;
}
