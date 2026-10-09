import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, Trash2 } from "lucide-react";
import {
  HStack,
  VStack,
  Button,
  Input,
  Text,
  Label,
  TableRowActions,
  TableRowAction,
  BulkDeleteDialog,
} from "@/shared/ui";
import {
  useGetPickupGroupsQuery,
  useCreatePickupGroupMutation,
  useDeletePickupGroupMutation,
} from "@/shared/api/endpoints/pickupGroupApi";
import type { IPickupGroup } from "@krasterisk/shared";
import { apiErrorMessage } from "../../lib/formValidation";
import cls from "./PickupGroupSelect.module.scss";

interface PickupGroupSelectProps {
  label: string;
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
}
export const PickupGroupSelect = ({
  label,
  selectedSlugs,
  onChange,
}: PickupGroupSelectProps) => {
  const { t } = useTranslation();
  const inputId = useId();
  const { data: groups = [], isLoading, isError } = useGetPickupGroupsQuery();
  const [createGroup, { isLoading: isCreating }] =
    useCreatePickupGroupMutation();
  const [deleteGroup, { isLoading: isDeleting }] =
    useDeletePickupGroupMutation();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState(false);
  const [deleting, setDeleting] = useState<IPickupGroup | null>(null);
  const handleAdd = async () => {
    if (isCreating) return;
    setNameError(!newName.trim());
    setError("");
    if (!newName.trim()) return;
    try {
      const result = await createGroup({ name: newName.trim() }).unwrap();
      onChange([...new Set([...selectedSlugs, result.slug])]);
      setNewName("");
      setIsAdding(false);
    } catch (failure: unknown) {
      setError(apiErrorMessage(failure, t("endpoints.groupCreateError")));
    }
  };
  const handleDelete = async () => {
    if (!deleting || isDeleting) return;
    setError("");
    try {
      await deleteGroup(deleting.uid).unwrap();
      onChange(selectedSlugs.filter((slug) => slug !== deleting.slug));
      setDeleting(null);
    } catch (failure: unknown) {
      setError(apiErrorMessage(failure, t("endpoints.groupDeleteError")));
    }
  };
  return (
    <VStack gap="8" max className={cls.root}>
      <HStack justify="between" max>
        <Text variant="small">{label}</Text>
        {!isAdding && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("endpoints.addGroup")}
            title={t("endpoints.addGroup")}
            onClick={() => {
              setIsAdding(true);
              setError("");
            }}
          >
            <Plus size={16} />
          </Button>
        )}
      </HStack>
      {isAdding && (
        <VStack gap="8" max>
          <Label htmlFor={inputId}>{t("endpoints.groupName")} *</Label>
          <HStack gap="8" className={cls.addRow} max>
            <Input
              id={inputId}
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t("endpoints.groupName")}
              aria-invalid={nameError}
              aria-describedby={nameError ? `${inputId}-error` : undefined}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <HStack gap="8">
              <Button
                type="button"
                size="icon"
                aria-label={t("endpoints.addGroup")}
                title={t("endpoints.addGroup")}
                onClick={() => void handleAdd()}
                disabled={isCreating}
              >
                <Plus size={16} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("common.cancel")}
                title={t("common.cancel")}
                disabled={isCreating}
                onClick={() => setIsAdding(false)}
              >
                <X size={16} />
              </Button>
            </HStack>
          </HStack>
          {nameError && (
            <Text id={`${inputId}-error`} className={cls.error}>
              {t("endpoints.required")}
            </Text>
          )}
        </VStack>
      )}
      {(error || isError) && (
        <Text role="alert" className={cls.error}>
          {error || t("endpoints.groupLoadError")}
        </Text>
      )}
      {groups.length === 0 ? (
        <Text variant="muted">
          {t(isLoading ? "common.loading" : "endpoints.noGroups")}
        </Text>
      ) : (
        <HStack gap="8" wrap="wrap" max>
          {groups.map((group) => (
            <HStack gap="4" key={group.uid} className={cls.group}>
              <Button
                type="button"
                variant={
                  selectedSlugs.includes(group.slug) ? "default" : "outline"
                }
                size="sm"
                className={cls.groupButton}
                aria-pressed={selectedSlugs.includes(group.slug)}
                onClick={() =>
                  onChange(
                    selectedSlugs.includes(group.slug)
                      ? selectedSlugs.filter((slug) => slug !== group.slug)
                      : [...selectedSlugs, group.slug],
                  )
                }
              >
                {group.name}
              </Button>
              <TableRowActions>
                <TableRowAction
                  danger
                  title={t("endpoints.deleteGroup", { name: group.name })}
                  aria-label={t("endpoints.deleteGroup", { name: group.name })}
                  disabled={isDeleting}
                  onClick={() => {
                    setError("");
                    setDeleting(group);
                  }}
                >
                  <Trash2 />
                </TableRowAction>
              </TableRowActions>
            </HStack>
          ))}
        </HStack>
      )}
      <BulkDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        labels={deleting ? [deleting.name] : []}
        allMatching={false}
        hasFilter={false}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        error={error}
        i18nNs="endpoints.groups"
      />
    </VStack>
  );
};
