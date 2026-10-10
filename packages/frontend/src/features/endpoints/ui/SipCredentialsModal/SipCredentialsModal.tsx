import { ModalBody, ModalSection } from '@/shared/ui';
import { useTranslation } from "react-i18next";
import cls from "./SipCredentialsModal.module.scss";
import { Key, Copy, Check, Loader2 } from "lucide-react";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type MouseEvent,
} from "react";
import {
  Button,
  Input,
  PasswordInput,
  Text,
  Label,
  Dialog,
  FormDialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui";
import { VStack, HStack, Flex } from "@/shared/ui/Stack";
import { useAppSelector, useAppDispatch } from "@/shared/hooks/useAppStore";
import { selectEndpointCredentialsSipId } from "../../model/selectors/endpointsPageSelectors";
import { endpointsPageActions } from "../../model/slice/endpointsPageSlice";
import { useGetEndpointCredentialsQuery } from "@/shared/api/endpoints/endpointApi";

/**
 * Clipboard API rejects writes inside a modal dialog ("Document is not focused")
 * and is missing on plain HTTP. Selection copy stays inside the dialog so the
 * focus trap does not clear it.
 */
async function copyText(
  text: string,
  container: HTMLElement | null,
): Promise<boolean> {
  // Start the async write during the click, then copy synchronously as well.
  // A modal often rejects the Clipboard API after the first await.
  let pending: Promise<void> | null = null;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      pending = navigator.clipboard.writeText(text);
    }
  } catch {
    pending = null;
  }
  const selectionOk = copyWithSelection(text, container);
  if (!pending) return selectionOk;
  try {
    await pending;
    return true;
  } catch {
    return selectionOk;
  }
}

function copyWithSelection(
  text: string,
  container: HTMLElement | null,
): boolean {
  const host = container ?? document.body;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  host.appendChild(textarea);
  const previous =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  host.removeChild(textarea);
  previous?.focus({ preventScroll: true });
  return ok;
}

function keepDialogFocused(event: MouseEvent<HTMLButtonElement>) {
  // Focusing the button makes Chrome treat the document as unfocused and reject clipboard writes.
  event.preventDefault();
}

export const SipCredentialsModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sipId = useAppSelector(selectEndpointCredentialsSipId);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    data: creds,
    isLoading,
    isError,
  } = useGetEndpointCredentialsQuery(sipId!, {
    skip: !sipId,
  });

  const [copyError, setCopyError] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    dispatch(endpointsPageActions.closeCredentialsModal());
    setCopiedField(null);
    setCopyError("");
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, [dispatch]);

  const copyToClipboard = useCallback(
    async (text: string, field: string) => {
      const ok = await copyText(text, contentRef.current);
      if (!ok) {
        setCopyError(t("endpoints.copyError"));
        return;
      }
      setCopyError("");
      setCopiedField(field);
      timers.current.push(
        setTimeout(() => {
          setCopiedField((current) => (current === field ? null : current));
        }, 2000),
      );
    },
    [t],
  );

  const copyAll = () => {
    if (!creds) return;
    const sipFields = [
      { label: t("endpoints.credServer"), value: creds.domain },
      { label: t("endpoints.credLogin"), value: creds.username },
      { label: t("endpoints.password"), value: creds.password },
    ];
    const blocks = [
      [
        t("endpoints.credSip"),
        ...sipFields.map(({ label, value }) => `${label}: ${value}`),
      ].join("\n"),
    ];
    if (creds.webrtc) {
      const webrtcFields = [
        { label: t("endpoints.credServer"), value: creds.webrtc.domain },
        { label: t("endpoints.credLogin"), value: creds.webrtc.username },
        { label: t("endpoints.password"), value: creds.webrtc.password },
        {
          label: t("endpoints.transport"),
          value: (creds.webrtc.transport || "wss").toUpperCase(),
        },
      ];
      blocks.push(
        [
          t("endpoints.credWebrtc"),
          ...webrtcFields.map(({ label, value }) => `${label}: ${value}`),
        ].join("\n"),
      );
    }
    void copyToClipboard(blocks.join("\n\n"), "all");
  };

  const renderCredBlock = (
    title: string,
    fields: { label: string; value: string; field: string }[],
  ) => (
    <VStack gap="12" className={cls.block}>
      <Text className={cls.title}>{title}</Text>
      {fields.map(({ label, value, field }) => (
        <VStack gap="4" key={field}>
          <Label htmlFor={`credential-${field}`} className={cls.label}>
            {label}
          </Label>
          <Flex gap="8" max>
            <Flex className={cls.inputWrap}>
              {field.includes("password") ? (
                <PasswordInput
                  id={`credential-${field}`}
                  readOnly
                  value={value}
                  className={cls.mono}
                />
              ) : (
                <Input
                  id={`credential-${field}`}
                  readOnly
                  value={value}
                  className={cls.mono}
                />
              )}
            </Flex>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cls.copyButton}
              aria-label={t("endpoints.copyField", { field: label })}
              onMouseDown={keepDialogFocused}
              onClick={() => {
                void copyToClipboard(value, field);
              }}
            >
              {copiedField === field ? (
                <Check size={16} className={cls.copied} />
              ) : (
                <Copy size={16} />
              )}
            </Button>
          </Flex>
        </VStack>
      ))}
    </VStack>
  );

  const sipFields = creds
    ? [
        {
          label: t("endpoints.credServer"),
          value: creds.domain,
          field: "domain",
        },
        {
          label: t("endpoints.credLogin"),
          value: creds.username,
          field: "username",
        },
        {
          label: t("endpoints.password"),
          value: creds.password,
          field: "password",
        },
      ]
    : [];

  const webrtcFields = creds?.webrtc
    ? [
        {
          label: t("endpoints.credServer"),
          value: creds.webrtc.domain,
          field: "w-domain",
        },
        {
          label: t("endpoints.credLogin"),
          value: creds.webrtc.username,
          field: "w-username",
        },
        {
          label: t("endpoints.password"),
          value: creds.webrtc.password,
          field: "w-password",
        },
        {
          label: t("endpoints.transport"),
          value: (creds.webrtc.transport || "wss").toUpperCase(),
          field: "w-transport",
        },
      ]
    : [];

  return (
    <Dialog open={!!sipId} onOpenChange={(open) => !open && handleClose()}>
      <FormDialogContent
        size="large"
        className={cls.dialog}
        ref={contentRef}
        aria-describedby={undefined}
      >
        <DialogHeader className={cls.header}>
          <HStack gap="8">
            <Key size={20} className={cls.icon} />
            <DialogTitle>{t("endpoints.sipCredentials")}</DialogTitle>
          </HStack>
        </DialogHeader>
        <ModalBody   className={cls.body}>
<ModalSection>
          {isLoading ? (
            <VStack
              gap="16"
              align="center"
              justify="center"
              className={cls.loading}
            >
              <Loader2 size={24} className={cls.spinner} />
              <Text variant="muted">{t("common.loading")}</Text>
            </VStack>
          ) : creds ? (
            <VStack align="stretch" gap="16">
              {renderCredBlock(t("endpoints.credSip"), sipFields)}

              {creds.webrtc &&
                renderCredBlock(t("endpoints.credWebrtc"), webrtcFields)}
            </VStack>
          ) : (
            <Text variant="muted" role={isError ? "alert" : undefined}>
              {t(
                isError ? "endpoints.credentialsError" : "endpoints.credEmpty",
              )}
            </Text>
          )}
          {copyError && (
            <Text role="alert" className={cls.error}>
              {copyError}
            </Text>
          )}
        </ModalSection>
</ModalBody>
        <DialogFooter className={cls.footer}>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("common.close")}
          </Button>
          {creds && (
            <Button
              type="button"
              onMouseDown={keepDialogFocused}
              onClick={copyAll}
              className={cls.copyAll}
            >
              {copiedField === "all" ? <Check size={16} /> : <Copy size={16} />}
              {t("endpoints.copyAll")}
            </Button>
          )}
        </DialogFooter>
      </FormDialogContent>
    </Dialog>
  );
};
