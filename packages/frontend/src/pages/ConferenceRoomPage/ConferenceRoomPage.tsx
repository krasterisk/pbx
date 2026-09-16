import { memo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';

export const ConferenceRoomPage = memo(() => {
  const { t } = useTranslation();
  const { uid } = useParams<{ uid: string }>();

  return (
    <VStack gap="16" data-testid="conference-room-page">
      <Text>{uid}</Text>
      <Link to="/conferences">{t('nav.conferences', 'Конференции')}</Link>
    </VStack>
  );
});

ConferenceRoomPage.displayName = 'ConferenceRoomPage';
