import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GitMerge, Plus } from 'lucide-react';
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
import { IvrsTable, ivrsActions } from '@/features/ivrs';
import cls from './IvrsPage.module.scss';

export const IvrsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page}>
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <GitMerge size={24} />
          </Flex>
          <VStack gap="4">
            <Text variant="h1" as="h1" className={cls.title}>
              {t('ivrs.title', 'Голосовые меню (IVR)')}
            </Text>
            <Text variant="muted">
              {t('ivrs.subtitle', 'Настройка интерактивных голосовых меню')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(ivrsActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          {t('ivrs.add', 'Добавить IVR')}
        </Button>
      </Flex>

      <Card className={cls.card}>
        <CardHeader className={cls.cardHeader}>
          <CardTitle className={cls.cardTitle}>
            {t('ivrs.listTitle', 'Список IVR')}
          </CardTitle>
        </CardHeader>
        <CardContent className={cls.cardContent}>
          <IvrsTable />
        </CardContent>
      </Card>
    </VStack>
  );
});

IvrsPage.displayName = 'IvrsPage';
