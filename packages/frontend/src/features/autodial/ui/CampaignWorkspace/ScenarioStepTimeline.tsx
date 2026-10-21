import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { observedScenarioSteps } from '../../model/scenarioEvidence';

export function ScenarioStepTimeline({ snapshot, evidence }: { snapshot: unknown; evidence: unknown }) {
  const { t } = useTranslation();
  return <VStack gap="8" max>{observedScenarioSteps(snapshot, evidence).map((step) => <VStack gap="4" max key={step.id}>
    <Text>{step.position}. {t(`routes.action.${step.type}`, { defaultValue: step.type })} · {t(`autodial.workspace.testEvidence.step.${step.status}`)}</Text>
    {step.text && <Text variant="muted">{step.text}</Text>}
    {step.type === 'toqueue' && step.detail === 'AGENT_CONNECTED' && <Text>{t('autodial.workspace.operatorConnection.connected')}</Text>}
    {step.digits !== null && <Text>{t('autodial.workspace.testEvidence.input')}: {step.digits || t('autodial.workspace.testEvidence.noDigits')}</Text>}
    {step.detail && step.status === 'failed' && <Text role="status">{t(step.detail === 'TTS_FAILED'
      ? 'autodial.workspace.testEvidence.ttsFailed' : step.type === 'collect_input' ? 'autodial.workspace.testEvidence.readFailed' : 'autodial.workspace.testEvidence.playbackFailed')}</Text>}
  </VStack>)}</VStack>;
}
