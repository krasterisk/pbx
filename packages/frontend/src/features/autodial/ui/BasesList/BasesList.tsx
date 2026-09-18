import { memo, useEffect, useState } from 'react';
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
import { autodialErrorKey } from '../../lib/mutationError';

export const BasesList = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeUid = useAppSelector(selectAutodialActiveBaseUid);
  const { data: bases, isLoading, isError, refetch } = useGetAutodialBasesQuery();
  const [deleteBase, { isLoading: isDeleting }] = useDeleteAutodialBaseMutation();
  const [error, setError] = useState<string | null>(null);

  // Land on the first base so the page is never an empty right-hand pane.
  useEffect(() => {
    if (bases && !bases.some((base) => base.uid === activeUid) && !isDeleting) {
      const next = bases[0]?.uid ?? null;
      if (next !== activeUid) dispatch(autodialPageActions.selectBase(next));
    }
  }, [activeUid, bases, dispatch, isDeleting]);
  const remove = async (uid: number) => {
    if (isDeleting) return;
    setError(null);
    try {
      await deleteBase(uid).unwrap();
      // Selection reconciles against the refreshed list, never the stale cache.
      await refetch();
    } catch (error) {
      setError(t(autodialErrorKey(error, 'autodial.common.deleteFailed')));
    }
  };

  return (
    <Card className={cls.card}>
      <CardHeader>
        <HStack gap="8" align="center">
          <Database size={20} className={cls.icon} />
          <Text className={cls.title}>{t('autodial.bases.title')}</Text>
        </HStack>
      </CardHeader>
      <CardContent className={cls.content}>
        {error && <Text role="alert">{error}</Text>}
        {isError ? (
          <VStack gap="8">
            <Text role="alert">{t('autodial.common.loadFailed')}</Text>
            <Button onClick={() => void refetch()}>{t('autodial.common.retry')}</Button>
          </VStack>
        ) : isLoading ? (
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
                      void remove(base.uid);
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
