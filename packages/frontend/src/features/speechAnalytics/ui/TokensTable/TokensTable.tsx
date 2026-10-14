import { useCrossPageRowSelection } from "@/shared/hooks/useCrossPageRowSelection";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormDialogContent,
  Input,
  Label,
  ModalBody,
  ModalSection,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectionCell,
  Text,
} from "@/shared/ui";
import { QueryErrorState } from "@/shared/ui/QueryErrorState";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import { Copy, KeyRound } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import cls from "./TokensTable.module.scss";

export interface SaApiTokenRow {
  principalId: string;
  name: string;
  projectId: string;
  projectName?: string;
  lastUsed: string | null;
}

export interface TokensTableProps {
  tokens: SaApiTokenRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** ADMIN / SUPERADMIN - supervisor must pass false (D-33). */
  canIssue?: boolean;
  moduleActive?: boolean;
  onIssue?: (input: {
    name: string;
    projectId: string;
  }) => Promise<{ secret: string } | null>;
  onRevoke?: (token: SaApiTokenRow) => Promise<void>;
  projects?: Array<{ id: string; name: string }>;
}

function formatLastUsed(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const TokensTable = memo(
  ({
    tokens,
    isLoading = false,
    isError = false,
    onRetry,
    canIssue = false,
    moduleActive = true,
    onIssue,
    onRevoke,
    projects = [],
  }: TokensTableProps) => {
    const { t } = useTranslation();
    const [issueOpen, setIssueOpen] = useState(false);
    const [issueName, setIssueName] = useState("");
    const [issueProjectId, setIssueProjectId] = useState("");
    const [issuing, setIssuing] = useState(false);
    const [secretOnce, setSecretOnce] = useState<string | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<SaApiTokenRow[] | null>(
      null,
    );
    const selection = useCrossPageRowSelection({ globalFilter: "" });
    const selectedTokens = tokens.filter(
      (token) => selection.rowSelection[token.principalId],
    );
    const [revoking, setRevoking] = useState(false);

    const showIssueCta = canIssue && moduleActive;
    const isEmpty = !isLoading && !isError && tokens.length === 0;

    const projectNameById = useMemo(() => {
      const map = new Map(projects.map((p) => [p.id, p.name]));
      return map;
    }, [projects]);

    const openIssue = () => {
      setIssueName("");
      setIssueProjectId(projects[0]?.id ?? "");
      setIssueOpen(true);
    };

    const handleIssue = async () => {
      if (!onIssue || !issueName.trim() || !issueProjectId || issuing) return;
      setIssuing(true);
      try {
        const result = await onIssue({
          name: issueName.trim(),
          projectId: issueProjectId,
        });
        setIssueOpen(false);
        if (result?.secret) {
          setSecretOnce(result.secret);
        }
      } finally {
        setIssuing(false);
      }
    };

    const closeSecret = () => {
      setSecretOnce(null);
    };

    const handleRevoke = async () => {
      if (!revokeTarget || !onRevoke || revoking) return;
      setRevoking(true);
      try {
        for (const token of revokeTarget) await onRevoke(token);
        selection.clearSelection();
        setRevokeTarget(null);
      } finally {
        setRevoking(false);
      }
    };

    if (isLoading) {
      return (
        <VStack gap="8" max data-testid="tokens-table-loading">
          <Skeleton className={cls.skeletonRow} />
          <Skeleton className={cls.skeletonRow} />
          <Skeleton className={cls.skeletonRow} />
        </VStack>
      );
    }

    if (isError) {
      return (
        <QueryErrorState
          message={t(
            "speechAnalytics.errorLoadTokens",
            "Не удалось загрузить токены. Повторите попытку.",
          )}
          onRetry={() => onRetry?.()}
          retryLabel={t("speechAnalytics.retry", "Повторить")}
          data-testid="tokens-table-error"
        />
      );
    }

    return (
      <VStack gap="16" max className={cls.wrap} data-testid="tokens-table">
        <Flex justify="between" align="center" max className={cls.header}>
          <VStack gap="4">
            <Text variant="h2" as="h2">
              {t("speechAnalytics.tokensTitle", "API-токены")}
            </Text>
            <Text variant="muted">
              {t(
                "speechAnalytics.tokensSubtitle",
                "Один токен привязан к одному проекту. Секрет показывается один раз.",
              )}
            </Text>
          </VStack>
          {showIssueCta && !isEmpty ? (
            <Button
              type="button"
              data-testid="tokens-issue-cta"
              onClick={openIssue}
            >
              <KeyRound size={16} />
              {t("speechAnalytics.createToken", "Выпустить токен")}
            </Button>
          ) : null}
        </Flex>

        {isEmpty ? (
          <VStack gap="12" max className={cls.empty} data-testid="tokens-empty">
            <Text variant="h3" as="h3">
              {t("speechAnalytics.emptyTokensHeading", "Токенов пока нет")}
            </Text>
            <Text variant="muted">
              {t(
                "speechAnalytics.emptyTokensBody",
                "Выпустите токен для внешнего API - один токен привязан к одному проекту.",
              )}
            </Text>
            {showIssueCta ? (
              <Button
                type="button"
                data-testid="tokens-issue-cta"
                onClick={openIssue}
              >
                <KeyRound size={16} />
                {t("speechAnalytics.createToken", "Выпустить токен")}
              </Button>
            ) : null}
          </VStack>
        ) : (
          <div className={cls.tableScroll}>
            <Table
              className={cls.table}
              selectedCount={selection.selectedCount}
              onDeleteSelected={
                onRevoke ? () => setRevokeTarget(selectedTokens) : undefined
              }
              deleteDisabled={revoking || !selectedTokens.length}
              deleteLabel={t("speechAnalytics.revokeToken", "Отозвать токен")}
              onClearSelection={selection.clearSelection}
            >
              <TableHeader>
                <TableRow>
                  <TableHead exportable={false} />
                  <TableHead>
                    {t("speechAnalytics.colTokenName", "Имя")}
                  </TableHead>
                  <TableHead>
                    {t("speechAnalytics.colTokenProject", "Проект")}
                  </TableHead>
                  <TableHead>
                    {t(
                      "speechAnalytics.colTokenLastUsed",
                      "Последнее использование",
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow
                    key={token.principalId}
                    data-testid={`tokens-row-${token.principalId}`}
                    data-selected={!!selection.rowSelection[token.principalId]}
                  >
                    <TableSelectionCell
                      {...selection.cardSelection(token.principalId)}
                      label={t("common.selectRowAria", { index: token.name })}
                    />
                    <TableCell className={cls.wrapCell}>{token.name}</TableCell>
                    <TableCell className={cls.wrapCell}>
                      {token.projectName ??
                        projectNameById.get(token.projectId) ??
                        token.projectId}
                    </TableCell>
                    <TableCell>
                      {formatLastUsed(
                        token.lastUsed,
                        t(
                          "speechAnalytics.tokenNeverUsed",
                          "Ещё не использовался",
                        ),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
          <FormDialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {t("speechAnalytics.createToken", "Выпустить токен")}
              </DialogTitle>
            </DialogHeader>
            <ModalBody>
              <ModalSection title={t("modal.sections.settings")}>
                <VStack align="stretch" gap="12" max>
                  <VStack align="stretch" gap="8" max>
                    <Label htmlFor="sa-token-name">
                      {t("speechAnalytics.tokenName", "Имя")}
                    </Label>
                    <Input
                      id="sa-token-name"
                      value={issueName}
                      onChange={(e) => setIssueName(e.target.value)}
                      disabled={issuing}
                    />
                  </VStack>
                  <VStack align="stretch" gap="8" max>
                    <Label htmlFor="sa-token-project">
                      {t(
                        "speechAnalytics.routeProjectLabel",
                        "Проект аналитики",
                      )}
                    </Label>
                    <Select
                      id="sa-token-project"
                      value={issueProjectId}
                      onChange={(e) => setIssueProjectId(e.target.value)}
                      disabled={issuing}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </Select>
                  </VStack>
                </VStack>
              </ModalSection>
            </ModalBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={issuing}
                onClick={() => setIssueOpen(false)}
              >
                {t("common.cancel", "Отмена")}
              </Button>
              <Button
                type="button"
                data-testid="tokens-issue-submit"
                disabled={issuing || !issueName.trim() || !issueProjectId}
                onClick={() => void handleIssue()}
              >
                {t("speechAnalytics.createToken", "Выпустить токен")}
              </Button>
            </DialogFooter>
          </FormDialogContent>
        </Dialog>

        <Dialog
          open={Boolean(secretOnce)}
          onOpenChange={(open) => {
            if (!open) closeSecret();
          }}
        >
          <DialogContent size="default" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {t(
                  "speechAnalytics.tokenSecretOnceTitle",
                  "Сохраните секрет токена",
                )}
              </DialogTitle>
            </DialogHeader>
            <VStack gap="12" max>
              <Text>
                {t(
                  "speechAnalytics.tokenSecretOnceBody",
                  "Секрет показывается один раз. Скопируйте его сейчас - позже увидеть нельзя.",
                )}
              </Text>
              <code className={cls.secret} data-testid="tokens-secret-once">
                {secretOnce}
              </code>
              <HStack gap="8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (secretOnce)
                      void navigator.clipboard?.writeText(secretOnce);
                  }}
                >
                  <Copy size={16} />
                  {t("common.copy", "Копировать")}
                </Button>
                <Button
                  type="button"
                  data-testid="tokens-secret-close"
                  onClick={closeSecret}
                >
                  {t("common.close", "Закрыть")}
                </Button>
              </HStack>
            </VStack>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(revokeTarget)}
          onOpenChange={(open) => {
            if (!open) setRevokeTarget(null);
          }}
        >
          <DialogContent size="default" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {t("speechAnalytics.revokeToken", "Отозвать токен")}
              </DialogTitle>
            </DialogHeader>
            <Text>
              {t("speechAnalytics.revokeTokenConfirm", {
                name: revokeTarget?.map((token) => token.name).join(", ") ?? "",
                defaultValue: `Отозвать токены «${revokeTarget?.map((token) => token.name).join(", ") ?? ""}»? Запросы с этими секретами перестанут работать.`,
              })}
            </Text>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={revoking}
                onClick={() => setRevokeTarget(null)}
              >
                {t("common.cancel", "Отмена")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={revoking}
                onClick={() => void handleRevoke()}
              >
                {t("speechAnalytics.revokeToken", "Отозвать токен")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VStack>
    );
  },
);

TokensTable.displayName = "TokensTable";
