import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDeleteAutodialBaseMutation,
  useGetAutodialBasesQuery,
} from '@/shared/api/endpoints/autodialApi';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { classNames } from '@/shared/lib/classNames/classNames';
import {
  autodialPageActions,
  selectAutodialActiveBaseUid,
} from '../../model/slice/autodialPageSlice';
import cls from './BasesList.module.scss';

export const BasesList = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeUid = useAppSelector(selectAutodialActiveBaseUid);
  const { data: bases, isLoading } = useGetAutodialBasesQuery();
  const [deleteBase] = useDeleteAutodialBaseMutation();

  // Land on the first base so the page is never an empty right-hand pane.
  useEffect(() => {
    if (activeUid === null && bases?.length) {
      dispatch(autodialPageActions.selectBase(bases[0].uid));
    }
  }, [activeUid, bases, dispatch]);

  return (
    <Card className={cls.card}>
      <CardHeader>
        <HStack gap="8" align="center">
          <Database size={20} className={cls.icon} />
          <Text className={cls.title}>{t('autodial.bases.title')}</Text>
        </HStack>
      </CardHeader>
      <CardContent className={cls.content}>
        {isLoading ? (
          <Flex justify="center" className={cls.loading}>
            <Loader2 size={20} className={cls.spinner} />
          </Flex>
        ) : (bases ?? []).length === 0 ? (
          <VStack gap="8" align="center" className={cls.empty}>
            <Text variant="muted">{t('autodial.bases.empty')}</Text>
          </VStack>
        ) : (
          <VStack gap="4" max>
            {(bases ?? []).map((base) => (
              <HStack
                key={base.uid}
                justify="between"
                align="center"
                max
                gap="8"
                className={classNames(cls.row, { [cls.rowActive]: base.uid === activeUid })}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className={cls.rowButton}
                  aria-current={base.uid === activeUid ? 'true' : undefined}
                  onClick={() => dispatch(autodialPageActions.selectBase(base.uid))}
                >
                  <VStack gap="2" align="start">
                    <Text as="span" className={cls.name}>
                      {base.name}
                    </Text>
                    <HStack gap="8" align="center">
                      <Badge variant="outline">
                        {t('autodial.bases.contacts', { count: base.contact_count ?? 0 })}
                      </Badge>
                      <Text as="span" className={cls.muted}>
                        {t('autodial.bases.fields', { count: base.fields?.length ?? 0 })}
                      </Text>
                    </HStack>
                  </VStack>
                </Button>
                <TableRowActions>
                  <TableRowAction
                    title={t('common.edit')}
                    aria-label={t('common.edit')}
                    onClick={() => dispatch(autodialPageActions.openEditBase(base.uid))}
                  >
                    <Pencil />
                  </TableRowAction>
                  <TableRowAction
                    danger
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    onClick={() => {
                      if (!window.confirm(t('autodial.bases.confirmDelete', { name: base.name }))) {
                        return;
                      }
                      void deleteBase(base.uid);
                      if (base.uid === activeUid) {
                        dispatch(autodialPageActions.selectBase(null));
                      }
                    }}
                  >
                    <Trash2 />
                  </TableRowAction>
                </TableRowActions>
              </HStack>
            ))}
          </VStack>
        )}
      </CardContent>
    </Card>
  );
});

BasesList.displayName = 'BasesList';
