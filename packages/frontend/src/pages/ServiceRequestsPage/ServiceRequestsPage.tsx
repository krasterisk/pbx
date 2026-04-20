import { useTranslation } from 'react-i18next';
import { Card, VStack, Text } from '@/shared/ui';
import { ServiceRequestsTable } from '@/features/serviceRequests';

export function ServiceRequestsPage() {
  const { t } = useTranslation();

  return (
    <VStack gap="24" className="h-[calc(100vh-5rem)]">
      <VStack gap="8" className="shrink-0">
        <Text variant="h2">{t('serviceRequests.title', 'Заявки клиентов')}</Text>
        <Text variant="muted">
          {t('serviceRequests.subtitle', 'Управление обращениями и отправка СМС')}
        </Text>
      </VStack>

      <Card className="flex-1 overflow-hidden p-6">
        <ServiceRequestsTable />
      </Card>
    </VStack>
  );
}
