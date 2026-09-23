import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  BulkDeleteDialog,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useBulkDeleteAutodialBasesMutation,
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
  const [bulkDelete, { isLoading: isBulkDeleting }] = useBulkDeleteAutodialBasesMutation();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (bases && !bases.some((base) => base.uid === activeUid) && !isDeleting && !isBulkDeleting) {
      const next = bases[0]?.uid ?? null;
      if (next !== activeUid) dispatch(autodialPageActions.selectBase(next));
    }
  }, [activeUid, bases, dispatch, isDeleting, isBulkDeleting]);

  const labels = useMemo(
    () => selected.map((uid) => bases?.find((base) => base.uid === uid)?.name ?? String(uid)),
    [bases, selected],
  );

  const toggle = (uid: number, checked: boolean) => {
    setSelected((current) =>
      checked ? [...new Set([...current, uid])] : current.filter((id) => id !== uid),
    );
  };

  const remove = async (uid: number) => {
    if (isDeleting || isBulkDeleting) return;
    setError(null);
    try {
      await deleteBase(uid).unwrap();
      setSelected((current) => current.filter((id) => id !== uid));
      await refetch();
    } catch (caught) {
      setError(t(autodialErrorKey(caught, 'autodial.common.deleteFailed')));
    }
  };

  const confirmBulk = async () => {
    if (!selected.length) return;
    setError(null);
    try {
      const result = await bulkDelete(selected).unwrap();
      setSelected([]);
      setBulkOpen(false);
      if (result.failed.length) {
        setError(t('autodial.bases.bulkPartialFailed'));
      }
      await refetch();
    } catch (caught) {
      setError(t(autodialErrorKey(caught, 'autodial.common.deleteFailed')));
    }
  };

  return (
    <Card className={cls.card}>
      <CardHeader>
        <HStack gap="8" align="center" justify="between" max>
          <HStack gap="8" align="center">
            <Database size={20} className={cls.icon} />
            <Text className={cls.title}>{t('autodial.bases.title')}</Text>
          </HStack>
          {selected.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setBulkOpen(true)}
              disabled={isBulkDeleting}
            >
              {t('autodial.bases.deleteSelected')}
            </Button>
          )}
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
                <Checkbox
                  checked={selected.includes(base.uid)}
                  onChange={(event) => toggle(base.uid, event.currentTarget.checked)}
                  aria-label={base.name}
                />
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
      <BulkDeleteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        labels={labels}
        allMatching={false}
        hasFilter={false}
        isDeleting={isBulkDeleting}
        onConfirm={() => void confirmBulk()}
        i18nNs="autodial.bases"
      />
    </Card>
  );
});

BasesList.displayName = 'BasesList';
