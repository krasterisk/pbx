import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetAiVoiceDeploymentsQuery,
  useIssueAiVoiceBrowserTicketMutation,
} from '../api/aiVoiceApi';

export const BrowserPreviewPanel = memo(() => {
  const { t } = useTranslation();
  const { data: deployments = [] } = useGetAiVoiceDeploymentsQuery();
  const browsers = deployments.filter((row) => row.kind === 'browser_test');
  const [deploymentId, setDeploymentId] = useState('');
  const [ticket, setTicket] = useState<{ id: string; expiresAt: string } | null>(null);
  const [micState, setMicState] = useState<'idle' | 'live' | 'denied'>('idle');
  const [issueTicket] = useIssueAiVoiceBrowserTicketMutation();
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const start = async () => {
    if (!deploymentId) return;
    try {
      const issued = await issueTicket(deploymentId).unwrap();
      setTicket(issued);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicState('live');
    } catch (error: unknown) {
      const name = error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';
      if (name === 'NotAllowedError' || name === 'NotFoundError') {
        setMicState('denied');
        return;
      }
      toast.error(t('aiRobots.previewFailed'));
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMicState('idle');
    setTicket(null);
  };

  return (
    <VStack gap="16" max data-testid="ai-robots-preview">
      <Text variant="h1" as="h1">{t('aiRobots.preview')}</Text>
      <Text variant="muted">{t('aiRobots.previewHint')}</Text>
      <Text variant="muted">{t('aiRobots.previewToolsHint')}</Text>
      <HStack gap="12" align="center">
        <Select
          aria-label={t('aiRobots.deployment')}
          value={deploymentId}
          onChange={(event) => setDeploymentId(event.target.value)}
        >
          <option value="">{t('aiRobots.pickDeployment')}</option>
          {browsers.map((row) => (
            <option key={row.id} value={row.id}>{row.id} · {row.status}</option>
          ))}
        </Select>
        <Button onClick={() => void start()} disabled={!deploymentId || micState === 'live'}>
          {t('aiRobots.startPreview')}
        </Button>
        <Button variant="outline" onClick={stop} disabled={micState === 'idle' && !ticket}>
          {t('aiRobots.stopPreview')}
        </Button>
      </HStack>
      {ticket ? <Text variant="muted">{t('aiRobots.ticketIssued', { expires: ticket.expiresAt })}</Text> : null}
      {micState === 'denied' ? <Text>{t('aiRobots.micDenied')}</Text> : null}
      {micState === 'live' ? <Text>{t('aiRobots.micLive')}</Text> : null}
    </VStack>
  );
});

BrowserPreviewPanel.displayName = 'BrowserPreviewPanel';
