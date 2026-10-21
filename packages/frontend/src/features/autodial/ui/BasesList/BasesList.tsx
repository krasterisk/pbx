import {
  useBulkDeleteAutodialBasesMutation,
  useGetAutodialBasesQuery,
} from "@/shared/api/endpoints/autodialApi";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import {
  Badge,
  BulkDeleteDialog,
  Button,
  Card,
  CardContent,
  CardHeader,
  TableCard,
  TableToolbar,
  Select,
  TableRowAction,
  Text,
} from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import { Database, Loader2, Pencil } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { autodialErrorKey } from "../../lib/mutationError";
import {
  autodialPageActions,
} from "../../model/slice/autodialPageSlice";
import cls from "./BasesList.module.scss";

export const BasesList = memo(({ onOpen }: { onOpen: (uid: number) => void }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    data: bases,
    isLoading,
    isError,
    refetch,
  } = useGetAutodialBasesQuery();
  const [bulkDelete, { isLoading: isBulkDeleting }] =
    useBulkDeleteAutodialBasesMutation();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const visibleBases = useMemo(() => (bases ?? []).filter((base) =>
    `${base.name} ${base.description ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === 'contacts' ? (b.contact_count ?? 0) - (a.contact_count ?? 0)
      : a.name.localeCompare(b.name, undefined, { numeric: true })), [bases, search, sort]);

  const labels = useMemo(
    () =>
      selected.map(
        (uid) => bases?.find((base) => base.uid === uid)?.name ?? String(uid),
      ),
    [bases, selected],
  );

  const toggle = (uid: number, checked: boolean) => {
    setSelected((current) =>
      checked
        ? [...new Set([...current, uid])]
        : current.filter((id) => id !== uid),
    );
  };

  const confirmBulk = async () => {
    if (!selected.length) return;
    setError(null);
    try {
      const result = await bulkDelete(selected).unwrap();
      setSelected([]);
      setBulkOpen(false);
      if (result.failed.length) {
        setError(t("autodial.bases.bulkPartialFailed"));
      }
      await refetch();
    } catch (caught) {
      setError(t(autodialErrorKey(caught, "autodial.common.deleteFailed")));
    }
  };

  return (
    <Card className={cls.card}>
      <CardHeader>
        <HStack gap="12" align="center" justify="between" wrap="wrap" max>
          <HStack gap="8" align="center">
            <Database size={20} className={cls.icon} />
            <Text className={cls.title}>{t("autodial.bases.title")}</Text>
          </HStack>
          <TableToolbar
            searchId="autodial-bases-search"
            searchValue={search}
            onSearchChange={setSearch}
            searchLabel={t('autodial.workspace.baseSearch')}
            searchPlaceholder={t('autodial.workspace.baseSearch')}
            showExport={false}
            actions={<Select aria-label={t('autodial.workspace.baseSort')} value={sort} onChange={(event) => setSort(event.target.value)}
              options={[{ value: 'name', label: t('autodial.workspace.sortName') }, { value: 'contacts', label: t('autodial.workspace.sortContacts') }]} />}
            selection={{
              selectedCount: selected.length,
              selectedIds: selected.map(String),
              selectAllMatching: (ids = []) => setSelected(ids.map(Number)),
              clearSelection: () => setSelected([]),
            }}
            selectionRowIds={visibleBases.map((base) => String(base.uid))}
            onDeleteSelected={() => setBulkOpen(true)}
            deleteDisabled={isBulkDeleting}
          />
        </HStack>
      </CardHeader>
      <CardContent className={cls.content}>
        {error && <Text role="alert">{error}</Text>}
        {isError ? (
          <QueryErrorState
            message={t("autodial.common.loadFailed")}
            onRetry={() => void refetch()}
            retryLabel={t("autodial.common.retry")}
          />
        ) : isLoading ? (
          <Flex justify="center" className={cls.loading}>
            <Loader2 size={20} className={cls.spinner} />
          </Flex>
        ) : visibleBases.length === 0 ? (
          <VStack gap="8" align="center" className={cls.empty}>
            <Text variant="muted">{t(search ? 'autodial.workspace.noMatchingBases' : 'autodial.bases.empty')}</Text>
          </VStack>
        ) : (
          <VStack gap="4" max>
            {visibleBases.map((base) => (
              <TableCard
                onActivate={() =>
                  onOpen(base.uid)
                }
                direction="row"
                key={base.uid}
                selection={{
                  checked: selected.includes(base.uid),
                  onCheckedChange: (checked) => toggle(base.uid, checked),
                  label: base.name,
                }}
                justify="between"
                align="center"
                max
                gap="8"
                className={cls.row}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className={cls.rowButton}
                  onClick={() =>
                    onOpen(base.uid)
                  }
                >
                  <VStack gap="2" align="start">
                    <Text as="span" className={cls.name}>
                      {base.name}
                    </Text>
                    <HStack gap="8" align="center">
                      <Badge variant="outline">
                        {t("autodial.bases.contacts", {
                          count: base.contact_count ?? 0,
                        })}
                      </Badge>
                      <Text as="span" className={cls.muted}>
                        {t("autodial.bases.fields", {
                          count: base.fields?.length ?? 0,
                        })}
                      </Text>
                    </HStack>
                  </VStack>
                </Button>
                <TableRowAction aria-label={t('autodial.workspace.baseSettings', { name: base.name })}
                  onClick={() => dispatch(autodialPageActions.openEditBase(base.uid))}><Pencil /></TableRowAction>
              </TableCard>
            ))}
          </VStack>
        )}
      </CardContent>
      <BulkDeleteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        labels={labels}
        allMatching={false}
        hasFilter={Boolean(search.trim())}
        isDeleting={isBulkDeleting}
        onConfirm={() => void confirmBulk()}
        i18nNs="autodial.bases"
      />
    </Card>
  );
});

BasesList.displayName = "BasesList";
