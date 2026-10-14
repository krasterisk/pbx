import { useInRouterContext, useSearchParams } from "react-router-dom";
import { DashboardJournalView } from "@/features/dashboard/ui/DashboardJournalView";
/**
 * Page: EndpointsPage - thin orchestrator
 *
 * Composes feature-level components for PJSIP subscriber management.
 * No business logic - only layout and dispatch.
 */
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Phone, Plus, Layers } from "lucide-react";
import { Button, Text, Tooltip } from "@/shared/ui";
import { Flex, HStack, VStack } from "@/shared/ui/Stack";
import { useAppDispatch } from "@/shared/hooks/useAppStore";
import {
  endpointsPageActions,
  EndpointsTable,
  EndpointFormModal,
  BulkCreateModal,
  SipCredentialsModal,
} from "@/features/endpoints";
import cls from "./EndpointsPage.module.scss";

const LegacyEndpointsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const sectionHeader = (
    <Flex justify="between" align="center" className={cls.header} max>
      <HStack gap="12" align="center">
        <Flex align="center" justify="center" className={cls.iconBadge}>
          <Phone size={24} aria-hidden />
        </Flex>
        <VStack gap="4" className={cls.titleBlock}>
          <Text variant="h1" as="h1" className={cls.title}>
            {t("endpoints.title", "Абоненты")}
          </Text>
          <Text variant="muted" className={cls.subtitle}>
            {t("endpoints.subtitle", "Внутренние номера и устройства")}
          </Text>
        </VStack>
      </HStack>
      <HStack gap="8" className={cls.actions}>
        <Tooltip content={t("endpoints.addRange", "Создать диапазон")}>
          <Button
            variant="outline"
            size="icon"
            className={cls.rangeBtn}
            aria-label={t("endpoints.addRange", "Создать диапазон")}
            onClick={() => dispatch(endpointsPageActions.openBulkModal())}
          >
            <Layers size={16} className={cls.createBtnIcon} />
          </Button>
        </Tooltip>
        <Tooltip content={t("endpoints.addEndpoint", "Добавить абонента")}>
          <Button
            size="icon"
            className={cls.createBtn}
            aria-label={t("endpoints.addEndpoint", "Добавить абонента")}
            onClick={() => dispatch(endpointsPageActions.openCreateModal())}
          >
            <Plus size={16} className={cls.createBtnIcon} />
          </Button>
        </Tooltip>
      </HStack>
    </Flex>
  );

  return (
    <VStack
      gap="24"
      max
      className={cls.page}
      data-testid="endpoints-page-responsive"
    >
      {sectionHeader}
      <Flex
        direction="column"
        align="stretch"
        max
        className={cls.tableWrap}
        data-testid="hybrid-table"
        data-hybrid="overflow-x-auto"
      >
        <EndpointsTable />
      </Flex>

      <EndpointFormModal />
      <BulkCreateModal />
      <SipCredentialsModal />
    </VStack>
  );
});

LegacyEndpointsPage.displayName = "LegacyEndpointsPage";
function RoutedEndpointsPage() {
  const [search] = useSearchParams();
  return search.get("dashboard") === "1" ? (
    <DashboardJournalView kind="endpoints" />
  ) : (
    <LegacyEndpointsPage />
  );
}
export const EndpointsPage = memo(() =>
  useInRouterContext() ? <RoutedEndpointsPage /> : <LegacyEndpointsPage />,
);
EndpointsPage.displayName = "EndpointsPage";
