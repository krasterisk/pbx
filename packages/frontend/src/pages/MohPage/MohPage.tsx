import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Music, Plus } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { MohTable, mohActions } from '@/features/moh';
import cls from './MohPage.module.scss';

export const MohPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page}>
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Music size={24} />
          </Flex>
          <VStack gap="4">
            <Text variant="h1" as="h1" className={cls.title}>
              {t('moh.title', 'Музыка на удержании')}
            </Text>
            <Text variant="muted">
              {t('moh.subtitle', 'Управление классами Music On Hold')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(mohActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('moh.add', 'Создать класс')}</Text>
        </Button>
      </Flex>

      <Card className={cls.card}>
        <CardHeader className={cls.cardHeader}>
          <CardTitle className={cls.cardTitle}>
            {t('moh.listTitle', 'Список классов MOH')}
          </CardTitle>
        </CardHeader>
        <CardContent className={cls.cardContent}>
          <MohTable />
        </CardContent>
      </Card>
    </VStack>
  );
});

MohPage.displayName = 'MohPage';
