import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Plus } from 'lucide-react';
import { Button, Card, CardContent, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  autodialPageActions,
  selectAutodialActiveBaseUid,
} from '@/features/autodial/model/slice/autodialPageSlice';
import { BasesList } from '@/features/autodial/ui/BasesList/BasesList';
import { BaseFormModal } from '@/features/autodial/ui/BaseFormModal/BaseFormModal';
import { ContactsGrid } from '@/features/autodial/ui/ContactsGrid/ContactsGrid';
import { ContactFormModal } from '@/features/autodial/ui/ContactFormModal/ContactFormModal';
import { ImportWizard } from '@/features/autodial/ui/ImportWizard/ImportWizard';
import { DncPanel } from '@/features/autodial/ui/DncPanel/DncPanel';
import cls from './AutodialBasesPage.module.scss';

export const AutodialBasesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeBaseUid = useAppSelector(selectAutodialActiveBaseUid);

  return (
    <VStack gap="24" max className={cls.page} data-testid="autodial-bases-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Database size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('autodial.bases.pageTitle')}
            </Text>
            <Text variant="muted">{t('autodial.bases.pageSubtitle')}</Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(autodialPageActions.openCreateBase())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('autodial.bases.create')}</Text>
        </Button>
      </Flex>

      <HStack gap="16" align="start" max className={cls.layout}>
        <VStack className={cls.sidebar} max>
          <BasesList />
        </VStack>
        <VStack className={cls.main} max>
          {activeBaseUid === null ? (
            <Card>
              <CardContent>
                <Flex justify="center" className={cls.empty}>
                  <Text variant="muted">{t('autodial.bases.selectPrompt')}</Text>
                </Flex>
              </CardContent>
            </Card>
          ) : (
            <ContactsGrid key={activeBaseUid} baseUid={activeBaseUid} />
          )}
        </VStack>
      </HStack>

      <DncPanel scopedAs="base" scopeUid={activeBaseUid} />

      <BaseFormModal />
      {activeBaseUid !== null && (
        <VStack>
          <ContactFormModal baseUid={activeBaseUid} />
          <ImportWizard baseUid={activeBaseUid} />
        </VStack>
      )}
    </VStack>
  );
});

AutodialBasesPage.displayName = 'AutodialBasesPage';
