import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CallsQuery } from "@krasterisk/shared";
import { BookmarkPlus, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Flex,
  Input,
  Label,
  Select,
  Text,
} from "@/shared/ui";
import {
  captureCallFilter,
  readSavedCallFilters,
  restoreCallFilter,
  type SavedCallFilter,
} from "../model/savedCallFilters";
import cls from "./Calls.module.scss";

export function SavedCallFilters({
  storageKey,
  query,
  timezone,
  onApply,
}: {
  storageKey: string;
  query: CallsQuery;
  timezone: string;
  onApply: (params: URLSearchParams) => void;
}) {
  const { t } = useTranslation();
  const [initial] = useState(() => {
    try {
      return {
        rows: readSavedCallFilters(localStorage, storageKey),
        error: false,
      };
    } catch {
      return { rows: [], error: true };
    }
  });
  const [rows, setRows] = useState<SavedCallFilter[]>(initial.rows);
  const [error, setError] = useState(
    initial.error ? "calls.savedStorageError" : "",
  );
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const persist = (next: SavedCallFilter[]) => {
    try {
      if (next.some((row) => row.params.length > 8192))
        throw new Error("Saved selection too large");
      localStorage.setItem(storageKey, JSON.stringify(next));
      setRows(next);
      setError("");
      return true;
    } catch {
      setError("calls.savedStorageError");
      return false;
    }
  };
  return (
    <>
      <Flex gap="8" wrap="wrap" align="center" className={cls.savedFilters}>
        <Select
          aria-label={t("calls.savedFilters")}
          value={selected}
          disabled={!rows.length}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">{t("calls.savedFilters")}</option>
          {rows.map((row) => (
            <option key={row.name} value={row.name}>
              {row.name}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected}
          onClick={() => {
            const saved = rows.find((row) => row.name === selected);
            if (saved) onApply(restoreCallFilter(saved, timezone));
          }}
        >
          {t("calls.applySaved")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setName("");
            setOpen(true);
          }}
        >
          <BookmarkPlus size={16} />
          {t("calls.saveFilters")}
        </Button>
        {selected && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("calls.deleteSaved")}
            onClick={() => {
              if (persist(rows.filter((row) => row.name !== selected)))
                setSelected("");
            }}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </Flex>
      {error && <Text role="status">{t(error)}</Text>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calls.saveFilters")}</DialogTitle>
            <DialogDescription>{t("calls.savedLocalHint")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = name.trim();
              if (
                !trimmed ||
                rows.length >= 20 ||
                rows.some(
                  (row) =>
                    row.name.toLocaleLowerCase() ===
                    trimmed.toLocaleLowerCase(),
                )
              ) {
                setError("calls.savedNameError");
                return;
              }
              const next = [
                ...rows,
                captureCallFilter(trimmed, query, timezone),
              ];
              if (persist(next)) {
                setSelected(trimmed);
                setOpen(false);
              }
            }}
          >
            <Label htmlFor="calls-saved-name">{t("calls.savedName")}</Label>
            <Input
              autoFocus
              id="calls-saved-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <Text role="status">{t(error)}</Text>}
            <Flex gap="8" className={cls.saveActions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                {t("common.save")}
              </Button>
            </Flex>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
