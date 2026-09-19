import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Input, Label, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetSaMetricsQuery,
  usePublishSaMetricMutation,
  type SaMetricRubric,
} from '../api/speechAnalyticsApi';

function keyFromName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64);
}

export const MetricEditor = memo(({ projectId }: { projectId: string }) => {
  const { t } = useTranslation();
  const { data: metrics = [] } = useGetSaMetricsQuery(projectId, { skip: !projectId });
  const [publish] = usePublishSaMetricMutation();
  const [displayName, setDisplayName] = useState('greeting_present');
  const [type, setType] = useState<SaMetricRubric['type']>('boolean');
  const [polarity, setPolarity] = useState<SaMetricRubric['polarity']>('positive');
  const [instructions, setInstructions] = useState('');
  const [weight, setWeight] = useState('1');
  const [required, setRequired] = useState(true);
  const [min, setMin] = useState('0');
  const [max, setMax] = useState('100');
  const [enumValues, setEnumValues] = useState('yes,no');

  const submit = () => {
    const key = keyFromName(displayName);
    if (!key) {
      toast.error(t('speechAnalytics.metricInvalid'));
      return;
    }
    const rubric: SaMetricRubric = {
      key,
      displayName,
      type,
      instructions,
      polarity,
      weight: Number(weight),
      required,
    };
    if (type === 'number') {
      rubric.min = Number(min);
      rubric.max = Number(max);
    }
    if (type === 'enum') {
      rubric.enumValues = enumValues.split(',').map((value) => value.trim()).filter(Boolean);
    }
    void publish({ id: projectId, operationKey: crypto.randomUUID(), rubric })
      .unwrap()
      .catch(() => toast.error(t('speechAnalytics.saveFailed')));
  };

  return (
    <VStack gap="12" max data-testid="sa-metric-editor">
      <Text variant="h2" as="h2">{t('speechAnalytics.metrics')}</Text>
      <Label htmlFor="metric-name">{t('speechAnalytics.metricWhat')}</Label>
      <Input id="metric-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      <Label htmlFor="metric-type">{t('speechAnalytics.metricType')}</Label>
      <Select id="metric-type" value={type} onChange={(event) => setType(event.target.value as SaMetricRubric['type'])}>
        <option value="boolean">{t('speechAnalytics.metricBoolean')}</option>
        <option value="number">{t('speechAnalytics.metricNumber')}</option>
        <option value="enum">{t('speechAnalytics.metricEnum')}</option>
        <option value="string">{t('speechAnalytics.metricString')}</option>
      </Select>
      <Label htmlFor="metric-polarity">{t('speechAnalytics.metricPolarity')}</Label>
      <Select
        id="metric-polarity"
        value={polarity}
        onChange={(event) => setPolarity(event.target.value as SaMetricRubric['polarity'])}
      >
        <option value="positive">{t('speechAnalytics.polarityGood')}</option>
        <option value="negative">{t('speechAnalytics.polarityProblem')}</option>
        <option value="informational">{t('speechAnalytics.polarityInfo')}</option>
      </Select>
      <Label htmlFor="metric-instructions">{t('speechAnalytics.metricEvidence')}</Label>
      <Input id="metric-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
      <Label htmlFor="metric-weight">{t('speechAnalytics.metricWeight')}</Label>
      <Input id="metric-weight" value={weight} onChange={(event) => setWeight(event.target.value)} />
      {type === 'number' ? (
        <HStack gap="8">
          <Input aria-label={t('speechAnalytics.metricMin')} value={min} onChange={(event) => setMin(event.target.value)} />
          <Input aria-label={t('speechAnalytics.metricMax')} value={max} onChange={(event) => setMax(event.target.value)} />
        </HStack>
      ) : null}
      {type === 'enum' ? (
        <Input
          aria-label={t('speechAnalytics.metricEnumValues')}
          value={enumValues}
          onChange={(event) => setEnumValues(event.target.value)}
        />
      ) : null}
      <Label htmlFor="metric-required">{t('speechAnalytics.metricRequired')}</Label>
      <input
        id="metric-required"
        type="checkbox"
        checked={required}
        onChange={(event) => setRequired(event.target.checked)}
      />
      <Button onClick={submit}>{t('speechAnalytics.publishMetric')}</Button>
      {metrics.map((row) => (
        <Text key={row.id} variant="muted">{row.metric_key}</Text>
      ))}
    </VStack>
  );
});

MetricEditor.displayName = 'MetricEditor';
