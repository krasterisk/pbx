import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useCreateSaProjectMutation,
  useGetSaProjectsQuery,
  usePublishSaProjectMutation,
  useSetSaProjectIntakeMutation,
} from '@/features/speechAnalytics/api/speechAnalyticsApi';

export const SpeechAnalyticsProjectsPage = memo(() => {
  const { t } = useTranslation();
  const { data: projects = [], isLoading } = useGetSaProjectsQuery();
  const [name, setName] = useState('Pilot');
  const [createProject] = useCreateSaProjectMutation();
  const [publish] = usePublishSaProjectMutation();
  const [setIntake] = useSetSaProjectIntakeMutation();

  return (
    <VStack gap="24" max data-testid="speech-analytics-projects">
      <Text variant="h1" as="h1">{t('speechAnalytics.projects')}</Text>
      <HStack gap="12">
        <Input value={name} onChange={(event) => setName(event.target.value)} aria-label={t('speechAnalytics.projectName')} />
        <Button onClick={() => void createProject({ name }).unwrap().catch(() => toast.error(t('speechAnalytics.saveFailed')))}>
          {t('speechAnalytics.create')}
        </Button>
      </HStack>
      {isLoading ? <Text>{t('speechAnalytics.loading')}</Text> : projects.map((project) => (
        <Card key={project.id}>
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <HStack gap="12" align="center">
              <Text variant="muted">{project.status}</Text>
              <Label htmlFor={`intake-${project.id}`}>{t('speechAnalytics.intake')}</Label>
              <Switch
                id={`intake-${project.id}`}
                checked={project.status !== 'archived'}
                onCheckedChange={(enabled) => {
                  void setIntake({ id: project.id, enabled });
                }}
              />
              <Button variant="outline" onClick={() => void publish({ id: project.id, operationKey: crypto.randomUUID() })}>
                {t('speechAnalytics.publish')}
              </Button>
              <Button asChild variant="outline">
                <Link to={`/speech-analytics/projects/${project.id}`}>{t('speechAnalytics.open')}</Link>
              </Button>
            </HStack>
          </CardContent>
        </Card>
      ))}
    </VStack>
  );
});

SpeechAnalyticsProjectsPage.displayName = 'SpeechAnalyticsProjectsPage';
