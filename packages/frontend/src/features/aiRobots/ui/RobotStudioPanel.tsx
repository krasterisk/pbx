import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Card, CardContent, CardHeader, CardTitle, Label, Switch, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAiAgentsQuery, useGetAiProvidersQuery, useGetAiToolsetsQuery } from '@/shared/api/endpoints/aiAgentsApi';
import { AiAgentModal } from '@/features/ai-agents/ui/AiAgentModal/AiAgentModal';
import {
  useCreateAiVoiceDeploymentMutation,
  useGetAiVoiceCapabilitiesQuery,
  useGetAiVoiceDeploymentsQuery,
  usePublishAiVoiceAgentMutation,
  useSetAiVoiceDeploymentReadyMutation,
} from '../api/aiVoiceApi';

export const RobotStudioPanel = memo(() => {
  const { t } = useTranslation();
  const { data: agents = [] } = useGetAiAgentsQuery();
  const { data: providers = [] } = useGetAiProvidersQuery();
  const { data: toolsets = [] } = useGetAiToolsetsQuery();
  const { data: deployments = [] } = useGetAiVoiceDeploymentsQuery();
  const { data: caps } = useGetAiVoiceCapabilitiesQuery();
  const [publish] = usePublishAiVoiceAgentMutation();
  const [createDeployment] = useCreateAiVoiceDeploymentMutation();
  const [setReady] = useSetAiVoiceDeploymentReadyMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<number | null>(null);
  const editing = agents.find((agent) => agent.uid === editingUid) ?? null;

  return (
    <VStack gap="16" max data-testid="ai-robots-studio">
      <Text variant="h1" as="h1">{t('aiRobots.studio')}</Text>
      <Text variant="muted">{t('aiRobots.studioHint')}</Text>
      {caps?.realtime === false ? (
        <Text variant="muted">{t('aiRobots.realtimeUnavailable')}</Text>
      ) : null}
      <HStack gap="12">
        <Button onClick={() => { setEditingUid(null); setModalOpen(true); }}>
          {t('aiRobots.newRobot')}
        </Button>
        <Button asChild variant="outline">
          <Link to="/ai-robots/sessions">{t('aiRobots.openSessions')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/ai-robots/preview">{t('aiRobots.openPreview')}</Link>
        </Button>
      </HStack>
      {agents.map((agent) => (
        <Card key={agent.uid}>
          <CardHeader><CardTitle>{agent.name}</CardTitle></CardHeader>
          <CardContent>
            <HStack gap="12" align="center">
              <Text variant="muted">{agent.mode} · rev {agent.draft_revision ?? 1}</Text>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingUid(agent.uid);
                  setModalOpen(true);
                }}
              >
                {t('common.edit')}
              </Button>
              <Button
                variant="outline"
                disabled={agent.mode !== 'cascade'}
                onClick={() => {
                  void publish({ uid: agent.uid, operationKey: crypto.randomUUID() })
                    .unwrap()
                    .catch(() => toast.error(t('aiRobots.publishFailed')));
                }}
              >
                {t('aiRobots.publish')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void createDeployment({ agentUid: agent.uid, kind: 'internal' })
                    .unwrap()
                    .catch(() => toast.error(t('aiRobots.deployFailed')));
                }}
              >
                {t('aiRobots.deployInternal')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void createDeployment({ agentUid: agent.uid, kind: 'browser_test' })
                    .unwrap()
                    .catch(() => toast.error(t('aiRobots.deployFailed')));
                }}
              >
                {t('aiRobots.deployBrowser')}
              </Button>
            </HStack>
          </CardContent>
        </Card>
      ))}
      {deployments.map((row) => (
        <Card key={row.id}>
          <CardHeader><CardTitle>{row.kind}</CardTitle></CardHeader>
          <CardContent>
            <HStack gap="12" align="center">
              <Text variant="muted">{row.id} · {row.status}</Text>
              <Label htmlFor={`ready-${row.id}`}>{t('aiRobots.ready')}</Label>
              <Switch
                id={`ready-${row.id}`}
                checked={row.status === 'ready'}
                disabled={row.kind === 'external_sip'}
                onCheckedChange={(ready) => {
                  void setReady({ id: row.id, ready });
                }}
              />
            </HStack>
          </CardContent>
        </Card>
      ))}
      {modalOpen ? (
        <AiAgentModal
          agent={editing}
          providers={providers}
          toolsets={toolsets}
          onClose={() => { setModalOpen(false); setEditingUid(null); }}
        />
      ) : null}
    </VStack>
  );
});

RobotStudioPanel.displayName = 'RobotStudioPanel';
