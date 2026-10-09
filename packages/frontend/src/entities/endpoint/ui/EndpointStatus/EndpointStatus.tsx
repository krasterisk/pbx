import { useTranslation } from "react-i18next";
import type { IEndpointListItem } from "@krasterisk/shared";
import { Flex, HStack, Text } from "@/shared/ui";
import cls from "./EndpointStatus.module.scss";

export const EndpointStatus = ({
  endpoint,
}: {
  endpoint: IEndpointListItem;
}) => {
  const { t, i18n } = useTranslation();
  const online = endpoint.status === "online";
  const browserOnline = endpoint.webrtc?.status === "online";
  return (
    <HStack gap="4" wrap="wrap">
      <Flex aria-hidden className={online ? cls.dotOnline : cls.dot} />
      <Text as="span" className={online ? cls.online : cls.offline}>
        {t(online ? "endpoints.statusOnline" : "endpoints.statusOffline")}
      </Text>
      {endpoint.webrtc_enabled && (
        <HStack
          gap="4"
          className={browserOnline ? cls.browserOnline : cls.browser}
          title={endpoint.webrtc?.id || t("endpoints.credWebrtc")}
        >
          <Flex
            aria-hidden
            className={browserOnline ? cls.dotOnline : cls.dot}
          />
          <Text as="span" variant="xs">
            {t("endpoints.credWebrtc")}
          </Text>
        </HStack>
      )}
      {endpoint.lastRegistered && (
        <Text as="span" variant="xs">
          {new Date(endpoint.lastRegistered * 1000).toLocaleString(
            i18n.language?.startsWith("en") ? "en-GB" : "ru-RU",
            {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            },
          )}
        </Text>
      )}
    </HStack>
  );
};
