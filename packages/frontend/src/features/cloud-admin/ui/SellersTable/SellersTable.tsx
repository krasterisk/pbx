import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, Plus, Star, Pencil, Trash2 } from 'lucide-react';
import {
  Card, CardHeader, CardContent,
  Button, DataTable, Text, Badge,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetSellersQuery,
  useDeleteSellerMutation,
  useSetDefaultSellerMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import type { IBillingSeller } from '@/entities/tenant';
import type { ColumnDef } from '@tanstack/react-table';
import { SellerFormModal } from '../SellerFormModal/SellerFormModal';
import cls from './SellersTable.module.scss';

export const SellersTable = memo(function SellersTable() {
  const { t } = useTranslation();
  const { data: sellers = [], isLoading } = useGetSellersQuery();
  const [deleteSeller] = useDeleteSellerMutation();
  const [setDefault] = useSetDefaultSellerMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IBillingSeller | null>(null);

  const columns = useMemo<ColumnDef<IBillingSeller>[]>(() => [
    {
      accessorKey: 'name',
      header: t('cloudAdmin.sellers.name', 'Название'),
      cell: ({ row }) => (
        <HStack gap="8" align="center">
          <Text as="span" className={cls.name}>{row.original.name}</Text>
          {row.original.isDefault && (
            <Badge data-testid={`seller-default-${row.original.id}`}>
              {t('cloudAdmin.sellers.defaultBadge', 'По умолчанию')}
            </Badge>
          )}
        </HStack>
      ),
    },
    {
      accessorKey: 'inn',
      header: t('cloudAdmin.sellers.inn', 'ИНН'),
      cell: ({ getValue }) => (
        <Text as="span" className={cls.muted}>{String(getValue() || '—')}</Text>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        const seller = row.original;
        return (
          <HStack gap="4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={t('common.edit')}
              aria-label={t('common.edit')}
              onClick={() => { setEditing(seller); setModalOpen(true); }}
            >
              <Pencil size={16} />
            </Button>
            {!seller.isDefault && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={t('cloudAdmin.sellers.makeDefault', 'Сделать по умолчанию')}
                aria-label={t('cloudAdmin.sellers.makeDefault', 'Сделать по умолчанию')}
                onClick={() => void setDefault(seller.id)}
              >
                <Star size={16} />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={t('common.delete')}
              aria-label={t('common.delete')}
              disabled={seller.isDefault}
              onClick={async () => {
                if (seller.isDefault) return;
                const ok = window.confirm(
                  t('cloudAdmin.sellers.deleteConfirm', 'Удалить поставщика «{{name}}»? Кабинеты будут переведены на поставщика по умолчанию.', { name: seller.name }),
                );
                if (!ok) return;
                try {
                  await deleteSeller(seller.id).unwrap();
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              <Trash2 size={16} />
            </Button>
          </HStack>
        );
      },
    },
  ], [t, deleteSeller, setDefault]);

  const toolbar = (
    <Flex justify="between" align="center" max>
      <HStack gap="8" align="center">
        <Building2 size={20} className={cls.toolbarIcon} />
        <Text className={cls.count}>
          {t('cloudAdmin.sellers.title', 'Поставщики')} ({sellers.length})
        </Text>
      </HStack>
      <Button
        id="sellers-create-btn"
        onClick={() => { setEditing(null); setModalOpen(true); }}
      >
        <Plus size={16} className={cls.createIcon} />
        <Text as="span">{t('cloudAdmin.sellers.create', 'Новый поставщик')}</Text>
      </Button>
    </Flex>
  );

  return (
    <VStack gap="20" max data-testid="sellers-table">
      <Card className={cls.card}>
        <CardHeader>{toolbar}</CardHeader>
        <CardContent className={cls.cardContent}>
          {isLoading ? (
            <Flex align="center" justify="center" className={cls.loading}>
              <Loader2 size={24} className={cls.spinner} />
            </Flex>
          ) : (
            <DataTable columns={columns} data={sellers} />
          )}
        </CardContent>
      </Card>

      <SellerFormModal
        open={modalOpen}
        seller={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
      />
    </VStack>
  );
});
