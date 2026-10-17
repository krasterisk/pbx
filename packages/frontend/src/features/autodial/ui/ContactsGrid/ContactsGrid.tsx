import {
  useDeleteAutodialContactMutation,
  useGetAutodialBaseQuery,
  useGetAutodialContactsQuery,
  useGetAutodialCampaignContactsQuery,
} from "@/shared/api/endpoints/autodialApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectionCell,
  TableToolbar,
  Text,
} from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import { AUTODIAL_DISPOSITIONS, type IAutodialBaseField, type IAutodialContact, type IAutodialCampaignContact } from "@krasterisk/shared";
import { Loader2, Plus, Upload } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { autodialErrorKey } from "../../lib/mutationError";
import { autodialDispositionLabel } from '../../lib/labels';
import { autodialPageActions } from "../../model/slice/autodialPageSlice";
import cls from "./ContactsGrid.module.scss";
import { ContactTaskActions } from '../CampaignWorkspace/ContactTaskActions';

const PAGE_SIZE = 25;

function renderValue(
  field: IAutodialBaseField,
  contact: IAutodialContact,
  yes: string,
  no: string,
  empty: string,
): string {
  const raw = contact.values?.[field.key];
  if (raw === undefined || raw === null || raw === "") return empty;
  if (field.type === "boolean") return raw ? yes : no;
  if (field.type === 'money' && typeof raw === 'number') return raw.toLocaleString(undefined, {
    style: 'currency', currency: field.format?.currency ?? 'RUB',
    ...(field.format?.decimal_places !== undefined ? { minimumFractionDigits: field.format.decimal_places, maximumFractionDigits: field.format.decimal_places } : {}),
  });
  if (field.type === 'date' && typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (field.format?.date_input === 'iso') return raw;
    if (field.format?.date_input === 'ru') return raw.split('-').reverse().join('.');
    return new Date(`${raw}T12:00:00`).toLocaleDateString();
  }
  return String(raw);
}

interface ContactsGridProps {
  baseUid: number;
  campaignUid?: number;
}

export const ContactsGrid = memo(({ baseUid, campaignUid }: ContactsGridProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [disposition, setDisposition] = useState('');
  const selection = useCrossPageRowSelection({ globalFilter: query });
  const [deletingSelected, setDeletingSelected] = useState(false);
  useEffect(() => {
    selection.clearSelection();
  }, [baseUid, selection.clearSelection]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { data: base } = useGetAutodialBaseQuery(baseUid);
  const baseContacts = useGetAutodialContactsQuery({
    baseUid,
    page,
    pageSize: PAGE_SIZE,
    q: query || undefined,
  }, { skip: campaignUid !== undefined });
  const campaignContacts = useGetAutodialCampaignContactsQuery({
    uid: campaignUid ?? 0, page, pageSize: PAGE_SIZE, q: query || undefined, disposition,
  }, { skip: campaignUid === undefined, pollingInterval: 15000 });
  const { currentData: data, isLoading, isFetching, isError, refetch } = campaignUid === undefined ? baseContacts : campaignContacts;
  const [deleteContact, { isLoading: isDeleting }] =
    useDeleteAutodialContactMutation();

  const fields = (base?.fields ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
  const contacts = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (data && page > pageCount) setPage(pageCount);
  }, [data, page, pageCount]);
  const remove = async (contactUid: number) => {
    setDeleteError(null);
    try {
      await deleteContact({ baseUid, contactUid }).unwrap();
      return true;
    } catch (error) {
      setDeleteError(
        t(autodialErrorKey(error, "autodial.common.deleteFailed")),
      );
      return false;
    }
  };
  const deleteSelected = async () => {
    if (isDeleting || deletingSelected || !selection.selectedCount) return;
    if (
      !window.confirm(
        `${t("autodial.contacts.confirmDelete")} (${selection.selectedCount})`,
      )
    )
      return;
    setDeletingSelected(true);
    try {
      for (const id of selection.selectedIds) {
        if (await remove(Number(id)))
          selection.cardSelection(id).onCheckedChange(false);
      }
    } finally {
      setDeletingSelected(false);
    }
  };

  return (
    <Card className={cls.card}>
      <CardHeader>
        <Flex justify="between" align="center" max className={cls.toolbar}>
          <HStack gap="8" align="center">
            <Text className={cls.title}>
              {base?.name ?? t("autodial.contacts.title")}
            </Text>
            <Badge variant="outline">
              {t("autodial.bases.contacts", { count: total })}
            </Badge>
            {isFetching && <Loader2 size={14} className={cls.spinner} />}
          </HStack>
          <HStack gap="8" align="center" className={cls.toolbarActions}>
            {campaignUid !== undefined && <Select
              aria-label={t('autodial.workspace.outcome')}
              value={disposition}
              onChange={(event) => { setDisposition(event.target.value); setPage(1); selection.clearSelection(); }}
              options={[{ value: '', label: t('autodial.workspace.allOutcomes') },
                ...AUTODIAL_DISPOSITIONS.map((value) => ({ value, label: autodialDispositionLabel(value, t) }))]}
            />}
            <TableToolbar
              searchId="autodial-contacts-search"
              searchPlaceholder={t("autodial.contacts.searchPlaceholder")}
              searchValue={search}
              onSearchChange={setSearch}
              selection={selection}
              onDeleteSelected={() => void deleteSelected()}
              deleteDisabled={isDeleting || deletingSelected}

              exportLabel={t("common.tableExportLoadedCsv")}
              exportTable={{
                data: contacts,
                getRowId: (contact) => String(contact.uid),
                rowSelection: selection.rowSelection,
                columns: [
                  {
                    accessorFn: (contact) =>
                      (contact.phones ?? [])
                        .map((phone) => phone.normalized || phone.raw)
                        .join(", "),
                    id: "phones",
                    header: t("autodial.contacts.phones"),
                  },
                  ...fields
                    .filter((field) => !field.is_phone)
                    .map((field) => ({
                      id: field.key,
                      header: field.label || field.key,
                      accessorFn: (contact: IAutodialContact) =>
                        renderValue(
                          field,
                          contact,
                          t("common.yes"),
                          t("common.no"),
                          "-",
                        ),
                    })),
                  {
                    accessorKey: "external_id",
                    header: t("autodial.contacts.externalId"),
                  },
                ],
                filename: "autodial-contacts-page",
              }}
            />
            <Button
              variant="outline"
              onClick={() => dispatch(autodialPageActions.openImport())}
            >
              <Upload size={16} />
              {t("autodial.import.open")}
            </Button>
            <Button
              onClick={() => dispatch(autodialPageActions.openCreateContact())}
            >
              <Plus size={16} />
              {t("autodial.contacts.add")}
            </Button>
          </HStack>
        </Flex>
      </CardHeader>

      <CardContent className={cls.content}>
        {deleteError && <Text role="alert">{deleteError}</Text>}
        {isError ? (
          <QueryErrorState
            message={t("autodial.common.loadFailed")}
            onRetry={() => void refetch()}
            retryLabel={t("autodial.common.retry")}
          />
        ) : isLoading || (isFetching && !data) ? (
          <Flex justify="center" className={cls.loading}>
            <Loader2 size={24} className={cls.spinner} />
          </Flex>
        ) : contacts.length === 0 ? (
          <VStack gap="8" align="center" className={cls.empty}>
            <Text>{t("autodial.contacts.empty")}</Text>
            <Text variant="muted">{t("autodial.contacts.emptyHint")}</Text>
          </VStack>
        ) : (
          <>
            <Flex className={cls.tableScroll}>
              <Table showSearch={false} showExport={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead exportable={false} />
                    <TableHead>{t("autodial.contacts.phones")}</TableHead>
                    {fields
                      .filter((field) => !field.is_phone)
                      .map((field) => (
                        <TableHead key={field.uid}>
                          {field.label || field.key}
                        </TableHead>
                      ))}
                    <TableHead>{t("autodial.contacts.externalId")}</TableHead>
                    {campaignUid !== undefined && <><TableHead>{t('autodial.workspace.taskState')}</TableHead><TableHead exportable={false}>{t('autodial.workspace.actions')}</TableHead></>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow
                      onActivate={() =>
                        dispatch(
                          autodialPageActions.openEditContact(contact.uid),
                        )
                      }
                      key={contact.uid}
                      data-selected={
                        !!selection.rowSelection[String(contact.uid)]
                      }
                    >
                      <TableSelectionCell
                        {...selection.cardSelection(String(contact.uid))}
                        label={t("common.selectRowAria", {
                          index: String(contact.uid),
                        })}
                      />
                      <TableCell>
                        <VStack gap="2" align="start">
                          {(contact.phones ?? []).map((phone) => (
                            <HStack key={phone.uid} gap="4" align="center">
                              <Text as="span" className={cls.phone}>
                                {phone.normalized || phone.raw}
                              </Text>
                              {phone.is_primary && (
                                <Badge variant="secondary">
                                  {t("autodial.contacts.primary")}
                                </Badge>
                              )}
                            </HStack>
                          ))}
                          {(contact.phones ?? []).length === 0 && (
                            <Text as="span" className={cls.muted}>
                              {t("autodial.contacts.noPhone")}
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
                              t("common.yes"),
                              t("common.no"),
                              "-",
                            )}
                          </TableCell>
                        ))}
                      <TableCell>{contact.external_id ?? "-"}</TableCell>
                      {campaignUid !== undefined && <TableCell><VStack gap="4" align="start">
                        {((contact as IAutodialCampaignContact).tasks ?? []).map((task) => <Text key={task.uid} as="span">
                          {autodialDispositionLabel(task.last_disposition, t)} · {t('autodial.workspace.attempts', { count: task.attempt_count })}
                          {task.dnc && ' · DNC'}
                          {task.next_attempt_at && ` · ${new Date(task.next_attempt_at).toLocaleString()}`}
                        </Text>)}
                        {(contact as IAutodialCampaignContact).blocked_phone_uids?.length > 0 && <Badge variant="destructive">DNC</Badge>}
                        {!(contact as IAutodialCampaignContact).tasks?.length && <Text variant="muted">{t('autodial.workspace.notStarted')}</Text>}
                      </VStack></TableCell>}
                      {campaignUid !== undefined && <TableCell><ContactTaskActions uid={campaignUid} contact={contact as IAutodialCampaignContact} /></TableCell>}
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

ContactsGrid.displayName = "ContactsGrid";
