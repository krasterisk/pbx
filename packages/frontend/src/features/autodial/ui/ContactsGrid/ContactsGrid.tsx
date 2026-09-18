import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import type { IAutodialBaseField, IAutodialContact } from '@krasterisk/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import {
  useDeleteAutodialContactMutation,
  useGetAutodialBaseQuery,
  useGetAutodialContactsQuery,
} from '@/shared/api/endpoints/autodialApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { autodialPageActions } from '../../model/slice/autodialPageSlice';
import cls from './ContactsGrid.module.scss';
import { autodialErrorKey } from '../../lib/mutationError';

const PAGE_SIZE = 25;

function renderValue(
  field: IAutodialBaseField,
  contact: IAutodialContact,
  yes: string,
  no: string,
  empty: string,
): string {
  const raw = contact.values?.[field.key];
  if (raw === undefined || raw === null || raw === '') return empty;
  if (field.type === 'boolean') return raw ? yes : no;
  return String(raw);
}

interface ContactsGridProps {
  baseUid: number;
}

export const ContactsGrid = memo(({ baseUid }: ContactsGridProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { data: base } = useGetAutodialBaseQuery(baseUid);
  const { currentData: data, isLoading, isFetching, isError, refetch } = useGetAutodialContactsQuery({
    baseUid,
    page,
    pageSize: PAGE_SIZE,
    q: query || undefined,
  });
  const [deleteContact, { isLoading: isDeleting }] = useDeleteAutodialContactMutation();

  const fields = (base?.fields ?? []).slice().sort((a, b) => a.position - b.position);
  const contacts = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (data && page > pageCount) setPage(pageCount);
  }, [data, page, pageCount]);
  const remove = async (contactUid: number) => {
    setDeleteError(null);
    try { await deleteContact({ baseUid, contactUid }).unwrap(); }
    catch (error) { setDeleteError(t(autodialErrorKey(error, 'autodial.common.deleteFailed'))); }
  };

  return (
    <Card className={cls.card}>
      <CardHeader>
        <Flex justify="between" align="center" max className={cls.toolbar}>
          <HStack gap="8" align="center">
            <Text className={cls.title}>{base?.name ?? t('autodial.contacts.title')}</Text>
            <Badge variant="outline">{t('autodial.bases.contacts', { count: total })}</Badge>
            {isFetching && <Loader2 size={14} className={cls.spinner} />}
          </HStack>
          <HStack gap="8" align="center" className={cls.toolbarActions}>
            <Flex align="center" className={cls.searchWrap}>
              <Search size={16} className={cls.searchIcon} />
              <Input
                id="autodial-contacts-search"
                placeholder={t('autodial.contacts.searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                className={cls.searchInput}
              />
            </Flex>
            <Button variant="outline" onClick={() => dispatch(autodialPageActions.openImport())}>
              <Upload size={16} />
              {t('autodial.import.open')}
            </Button>
            <Button onClick={() => dispatch(autodialPageActions.openCreateContact())}>
              <Plus size={16} />
              {t('autodial.contacts.add')}
            </Button>
          </HStack>
        </Flex>
      </CardHeader>

      <CardContent className={cls.content}>
        {deleteError && <Text role="alert">{deleteError}</Text>}
        {isError ? (
          <VStack gap="8">
            <Text role="alert">{t('autodial.common.loadFailed')}</Text>
            <Button onClick={() => void refetch()}>{t('autodial.common.retry')}</Button>
          </VStack>
        ) : isLoading || (isFetching && !data) ? (
          <Flex justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        ) : contacts.length === 0 ? (
          <VStack gap="8" align="center" className={cls.empty}>
            <Text>{t('autodial.contacts.empty')}</Text>
            <Text variant="muted">{t('autodial.contacts.emptyHint')}</Text>
          </VStack>
        ) : (
          <>
            <Flex className={cls.tableScroll}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('autodial.contacts.phones')}</TableHead>
                    {fields
                      .filter((field) => !field.is_phone)
                      .map((field) => (
                        <TableHead key={field.uid}>{field.label || field.key}</TableHead>
                      ))}
                    <TableHead>{t('autodial.contacts.externalId')}</TableHead>
                    <TableHead className={cls.actionsHead}>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.uid}>
                      <TableCell>
                        <VStack gap="2" align="start">
                          {(contact.phones ?? []).map((phone) => (
                            <HStack key={phone.uid} gap="4" align="center">
                              <Text as="span" className={cls.phone}>
                                {phone.normalized || phone.raw}
                              </Text>
                              {phone.is_primary && (
                                <Badge variant="secondary">
                                  {t('autodial.contacts.primary')}
                                </Badge>
                              )}
                            </HStack>
                          ))}
                          {(contact.phones ?? []).length === 0 && (
                            <Text as="span" className={cls.muted}>
                              {t('autodial.contacts.noPhone')}
                            </Text>
                          )}
                        </VStack>
                      </TableCell>
                      {fields
                        .filter((field) => !field.is_phone)
                        .map((field) => (
                          <TableCell key={field.uid}>
                            {renderValue(
                              field,
                              contact,
                              t('common.yes'),
                              t('common.no'),
                              '-',
                            )}
                          </TableCell>
                      ))}
                      <TableCell>{contact.external_id ?? '-'}</TableCell>
                      <TableCell>
                        <TableRowActions>
                          <TableRowAction
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                            onClick={() =>
                              dispatch(autodialPageActions.openEditContact(contact.uid))
                            }
                          >
                            <Pencil />
                          </TableRowAction>
                          <TableRowAction
                            danger
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                            onClick={() => {
                              if (!window.confirm(t('autodial.contacts.confirmDelete'))) return;
                              if (!isDeleting) void remove(contact.uid);
                            }}
                          >
                            <Trash2 />
                          </TableRowAction>
                        </TableRowActions>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Flex>

            {pageCount > 1 && (
              <Flex justify="center" className={cls.pagination}>
                <Pagination
                  currentPage={page}
                  totalPages={pageCount}
                  onPageChange={setPage}
                />
              </Flex>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

ContactsGrid.displayName = 'ContactsGrid';
