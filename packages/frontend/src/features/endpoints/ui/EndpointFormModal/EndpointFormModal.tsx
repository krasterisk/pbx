import { ModalBody, ModalSection } from '@/shared/ui';
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button, Input, PasswordInput, Select, Textarea, InfoTooltip, Switch, Label, Text, Dialog, FormDialogContent, DialogHeader, DialogTitle, DialogFooter, Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui";
import { VStack, HStack, Flex } from "@/shared/ui/Stack";
import cls from "./EndpointFormModal.module.scss";
import { useAppSelector, useAppDispatch } from "@/shared/hooks/useAppStore";
import {
  selectEndpointIsModalOpen,
  selectSelectedEndpoint,
  selectEndpointModalMode,
} from "../../model/selectors/endpointsPageSelectors";
import { endpointsPageActions } from "../../model/slice/endpointsPageSlice";
import {
  useCreateEndpointMutation,
  useUpdateEndpointMutation,
} from "@/shared/api/endpoints/endpointApi";
import { useGetContextsQuery } from "@/shared/api/endpoints/contextApi";
import { useGetProvisionTemplatesQuery } from "@/shared/api/endpoints/provisionTemplateApi";
import { PickupGroupSelect } from "../PickupGroupSelect";
import { ADVANCED_PJSIP_FIELDS } from "../../config/pjsipAdvancedFields";
import {
  PRIMARY_NAT_PROFILE_OPTIONS,
  type PrimaryNatProfileId,
  buildNatProfilePatch,
  detectNatProfile,
} from "../../config/natProfiles";
import { AdvancedSettingsBuilder } from "../AdvancedSettingsBuilder";

import { toast } from "react-toastify";
import { apiErrorMessage, validNetworks } from "../../lib/formValidation";
import { validatePjsipSettings } from "@/shared/lib/pjsipSettings";
import { useGetTenantSettingsQuery, ENDPOINT_EXPERT_MODE_SETTING } from "@/entities/tenantSettings";
import { useDefaultContext } from "@/shared/lib/useDefaultContext";

const ENDPOINT_TABS = [
  { id: "basic", labelKey: "endpoints.tabBasic" },
  { id: "network", labelKey: "endpoints.tabNetwork" },
  {
    id: "security",
    labelKey: "endpoints.tabSecurity",
  },
  { id: "calls", labelKey: "endpoints.tabCalls" },
  {
    id: "provision",
    labelKey: "endpoints.tabProvision",
  },
  {
    id: "advanced",
    labelKey: "endpoints.tabAdvanced",
  },
] as const;

type EndpointTab = (typeof ENDPOINT_TABS)[number]["id"];

function BasicSettings({ expertMode, children }: { expertMode: boolean; children: ReactNode }) {
  return expertMode ? <TabsContent value="basic">{children}</TabsContent> : <VStack max align="stretch">{children}</VStack>;
}

const CODEC_OPTIONS = [
  "ulaw",
  "alaw",
  "g722",
  "g729",
  "gsm",
  "opus",
  "h264",
  "vp8",
];

const TRANSPORT_OPTIONS = [
  { value: "", label: "endpoints.defaultOption" },
  { value: "transport-udp", label: "UDP" },
  { value: "transport-tcp", label: "TCP" },
  { value: "transport-tls", label: "TLS" },
  { value: "transport-ws", label: "WebSocket (WS)" },
  { value: "transport-wss", label: "WebSocket Secure (WSS)" },
];

function generatePassword(length = 16): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let result = "";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export const EndpointFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectEndpointIsModalOpen);
  const selected = useAppSelector(selectSelectedEndpoint);
  const mode = useAppSelector(selectEndpointModalMode);

  const [createEndpoint, { isLoading: isCreating }] =
    useCreateEndpointMutation();
  const [updateEndpoint, { isLoading: isUpdating }] =
    useUpdateEndpointMutation();
  const { data: contexts = [] } = useGetContextsQuery();
  const { data: templates = [] } = useGetProvisionTemplatesQuery();

  const [activeTab, setActiveTab] = useState<EndpointTab>("basic");
  const { data: tenantSettings } = useGetTenantSettingsQuery();
  const globalExpertMode = tenantSettings?.[ENDPOINT_EXPERT_MODE_SETTING] === true;
  const [sessionExpertMode, setSessionExpertMode] = useState(false);
  const expertMode = globalExpertMode || sessionExpertMode;

  const changeExpertMode = (enabled: boolean) => {
    setSessionExpertMode(enabled);
    setActiveTab("basic");
  };

  // Form state
  const [extension, setExtension] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [context, setContext] = useState("");
  const [transport, setTransport] = useState("transport-udp");
  const [codecs, setCodecs] = useState<string[]>(["ulaw", "alaw", "g722"]);
  const [natProfile, setNatProfile] = useState<PrimaryNatProfileId>("nat");
  /** Opt-in WebRTC companion - default off */
  const [webrtcEnabled, setWebrtcEnabled] = useState(false);
  const [blfEnabled, setBlfEnabled] = useState(false);

  // Call Groups
  const [namedCallGroup, setNamedCallGroup] = useState<string[]>([]);
  const [namedPickupGroup, setNamedPickupGroup] = useState<string[]>([]);

  // Provisioning
  const [provisionEnabled, setProvisionEnabled] = useState(false);
  const [macAddress, setMacAddress] = useState("");
  const [provisionTemplateId, setProvisionTemplateId] = useState<number | "">(
    "",
  );
  const [pvVars, setPvVars] = useState("");

  // Security
  const [permit, setPermit] = useState("");
  const [deny, setDeny] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advancedValid, setAdvancedValid] = useState(true);
  const [serverError, setServerError] = useState("");
  const fieldError = (key: string) =>
    errors[key] ? (
      <Text id={`ep-${key}-error`} role="alert" className={cls.fieldError}>
        {t(errors[key])}
      </Text>
    ) : null;

  // Advanced Dynamic Settings
  const [advancedState, setAdvancedState] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("basic");
    setSessionExpertMode(false);
    setErrors({});
    setServerError("");
    setAdvancedValid(true);

    if (mode === "edit" && selected) {
      setExtension(selected.extension || "");
      const match = (selected.callerid || "").match(/^"(.+?)"/);
      setDisplayName(match ? match[1] : "");
      setDepartment(selected.department || "");
      setPassword("");
      setContext(selected.context || "");
      setTransport(selected.transport || "");
      setCodecs(
        (selected.allow || "ulaw,alaw").split(",").map((s: string) => s.trim()),
      );
      const detected = detectNatProfile({
        webrtc: selected.webrtc_enabled ? "yes" : null,
        direct_media: selected.direct_media ?? null,
        force_rport: selected.force_rport ?? null,
      });
      setNatProfile(detected === "webrtc" ? "nat" : detected);
      setWebrtcEnabled(!!selected.webrtc_enabled);
      setBlfEnabled(
        selected.blf_enabled ??
          ["yes", "true", "on"].includes(String(selected.allow_subscribe)),
      );

      setNamedCallGroup(
        (selected.named_call_group || "").split(",").filter(Boolean),
      );
      setNamedPickupGroup(
        (selected.named_pickup_group || "").split(",").filter(Boolean),
      );

      setProvisionEnabled(!!selected.provision_enabled);
      setMacAddress(selected.mac_address || "");
      setProvisionTemplateId(selected.provision_template_id || "");
      setPvVars(selected.pv_vars || "");
      setPermit(selected.permit || "");
      setDeny(selected.deny || "");

      const initAdv: Record<string, string> = {};
      ADVANCED_PJSIP_FIELDS.forEach((key) => {
        if (
          selected[key] !== undefined &&
          selected[key] !== null &&
          selected[key] !== ""
        ) {
          initAdv[key] = String(selected[key]);
        }
      });
      setAdvancedState(initAdv);
    } else {
      setExtension("");
      setDisplayName("");
      setDepartment("");
      setPassword(generatePassword());
      setContext("");
      setTransport("transport-udp");
      setCodecs(["ulaw", "alaw", "g722"]);
      setNatProfile("nat");
      setWebrtcEnabled(false);
      setBlfEnabled(false);
      setNamedCallGroup([]);
      setNamedPickupGroup([]);
      setProvisionEnabled(false);
      setMacAddress("");
      setProvisionTemplateId("");
      setPvVars("");
      setPermit("");
      setDeny("");
      setAdvancedState({});
    }
  }, [mode, selected, isOpen]);

  const chooseContext = useDefaultContext(isOpen, mode === "create", contexts, "endpoints", setContext);

  const handleClose = useCallback(() => {
    dispatch(endpointsPageActions.closeModal());
  }, [dispatch]);

  const handleSubmit = async () => {
    if (isCreating || isUpdating) return;
    const next: Record<string, string> = {};
    if (!extension.trim() || extension.length > 20)
      next.extension = "endpoints.invalidExtension";
    if (!context) next.context = "endpoints.required";
    if ((mode === "create" || password) && password.length < 4)
      next.password = "endpoints.passwordMinimum";
    if (!codecs.length) next.codecs = "endpoints.required";
    if (!validNetworks(permit)) next.permit = "endpoints.invalidNetworks";
    if (!validNetworks(deny)) next.deny = "endpoints.invalidNetworks";
    if (provisionEnabled && !/^[a-f0-9]{12}$/i.test(macAddress))
      next.mac = "endpoints.invalidMac";
    if (
      provisionTemplateId !== "" &&
      !Number.isSafeInteger(provisionTemplateId)
    )
      next.tpl = "endpoints.invalidTemplate";
    if (
      !advancedValid ||
      !validatePjsipSettings(advancedState, ADVANCED_PJSIP_FIELDS)
    )
      next.advanced = "endpoints.invalidSettings";
    setErrors(next);
    setServerError("");
    if (Object.keys(next).length) {
      if (!(next.extension || next.context || next.password)) {
        setSessionExpertMode(true);
      }
      setActiveTab(
        next.extension || next.context || next.password
          ? "basic"
          : next.codecs
            ? "network"
            : next.permit || next.deny
              ? "security"
              : next.mac || next.tpl
                ? "provision"
                : "advanced",
      );
      return;
    }
    try {
      if (mode === "create") {
        const saved = await createEndpoint({
          extension,
          password,
          displayName: displayName || undefined,
          department: department || undefined,
          context,
          transport: transport || undefined,
          codecs: codecs.join(","),
          natProfile,
          webrtcEnabled,
          blfEnabled,
          namedCallGroup: namedCallGroup.join(","),
          namedPickupGroup: namedPickupGroup.join(","),
          provisionEnabled,
          macAddress: macAddress || undefined,
          provisionTemplateId: provisionTemplateId || undefined,
          pvVars: pvVars || undefined,
          advanced: {
            permit: permit || null,
            deny: deny || null,
            ...advancedState,
          },
        }).unwrap();
        if (saved.blf_applied === false)
          toast.warning(t("endpoints.blfPending"));
      } else if (selected) {
        // Update API takes raw PJSIP columns (no natProfile). Apply the selected
        // profile patch after advancedState so profile fields always win.
        const natPatch = buildNatProfilePatch(natProfile);
        const saved = await updateEndpoint({
          sipId: selected.id,
          data: {
            endpoint: {
              callerid: displayName
                ? `"${displayName}" <${extension}>`
                : `"${extension}" <${extension}>`,
              department: department || "",
              context: context || undefined,
              transport: transport || undefined,
              allow: codecs.join(","),
              named_call_group: namedCallGroup.join(","),
              named_pickup_group: namedPickupGroup.join(","),
              provision_enabled: provisionEnabled ? 1 : 0,
              mac_address: macAddress || "",
              provision_template_id: provisionTemplateId || null,
              pv_vars: pvVars || "",
              webrtc_enabled: webrtcEnabled,
              permit: permit || null,
              deny: deny || null,
              ...advancedState,
              ...natPatch,
              blf_enabled: blfEnabled,
            },
            ...(password ? { auth: { password } } : {}),
          },
        }).unwrap();
        if (saved.blf_applied === false)
          toast.warning(t("endpoints.blfPending"));
      }
      handleClose();
    } catch (failure: unknown) {
      setServerError(apiErrorMessage(failure, t("endpoints.saveError")));
    }
  };

  const toggleCodec = (codec: string) => {
    setCodecs((prev) =>
      prev.includes(codec) ? prev.filter((c) => c !== codec) : [...prev, codec],
    );
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !isLoading && handleClose()}
    >
      <FormDialogContent
        size="large"
        aria-describedby={undefined}
        data-testid="endpoint-form-modal"
      >
        <DialogHeader className={cls.header}>
          <DialogTitle className={cls.dialogTitle}>
            {mode === "create"
              ? t("endpoints.addEndpoint")
              : t("endpoints.editEndpoint")}
          </DialogTitle>
        </DialogHeader>

        <Flex
          as="form"
          noValidate
          direction="column"
          align="stretch"
          className={cls.form}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
            <HStack gap="8" className={cls.expertToggle}>
              <Switch id="ep-expert-mode" checked={expertMode} onCheckedChange={changeExpertMode} disabled={isLoading || globalExpertMode} />
              <Label htmlFor="ep-expert-mode">{t("endpoints.expertMode")}</Label>
              <InfoTooltip text={t("endpoints.expertModeHint")} />
            </HStack>
          <Tabs
            value={expertMode ? activeTab : "basic"}
            onValueChange={(value) => setActiveTab(value as EndpointTab)}
            className={cls.tabs}
          >
            {expertMode && <TabsList
              aria-label={
                mode === "create"
                  ? t("endpoints.addEndpoint")
                  : t("endpoints.editEndpoint")
              }
            >
              {ENDPOINT_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  data-testid={`endpoint-tab-${tab.id}`}
                >
                  {t(tab.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>}

            <ModalBody


              className={cls.formBody}
              data-testid="endpoint-form-body"
              data-viewport="360,768,1440"
              data-overflow="y"
            >
              <BasicSettings expertMode={expertMode}>
                <VStack align="stretch" gap="16" max>
<ModalSection title={t("modal.sections.identity")}>
<VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label htmlFor="ep-extension" className={cls.fieldLabel}>
                        {t("endpoints.extension")} *
                      </Label>
                      <InfoTooltip text={t("endpoints.extensionDesc")} />
                    </HStack>
                    <Input
                      id="ep-extension"
                      maxLength={20}
                      aria-invalid={!!errors.extension}
                      aria-describedby={
                        errors.extension ? "ep-extension-error" : undefined
                      }
                      value={extension}
                      onChange={(e) => setExtension(e.target.value)}
                      placeholder="100"
                      disabled={mode === "edit"}
                      className={cls.mono}
                    />
                    {fieldError("extension")}
                  </VStack>
<VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label htmlFor="ep-name" className={cls.fieldLabel}>
                        {t("endpoints.displayName")}
                      </Label>
                      <InfoTooltip text={t("endpoints.displayNameDesc")} />
                    </HStack>
                    <Input
                      id="ep-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t("endpoints.displayNamePlaceholder")}
                    />
                  </VStack>
<VStack align="stretch" gap="4">
                    <Label htmlFor="ep-dept" className={cls.fieldLabel}>
                      {t("endpoints.department")}
                    </Label>
                    <Input
                      id="ep-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder={t("endpoints.departmentPlaceholder")}
                    />
                  </VStack>
</ModalSection>
<ModalSection title={t("modal.sections.connection")}>
<HStack
                    align="center"
                    justify="between"
                    className={cls.toggleRow}
                  >
                    <HStack gap="4" align="center">
                      <Label className={cls.toggleLabel} htmlFor="ep-webrtc">
                        {t("endpoints.webrtcClient")}
                      </Label>
                      <InfoTooltip text={t("endpoints.webrtcClientHint")} />
                    </HStack>
                    <Switch
                      id="ep-webrtc"
                      checked={webrtcEnabled}
                      onCheckedChange={(checked) => setWebrtcEnabled(checked)}
                    />
                  </HStack>
<VStack align="stretch" gap="8" max>
                    <Label htmlFor="ep-password" className={cls.fieldLabel}>
                      {t("endpoints.password")}
                      {mode === "create" ? " *" : ""}
                    </Label>
                    <HStack gap="8" max>
                      <Flex className={cls.passwordControl}>
                        <PasswordInput
                          id="ep-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={
                            mode === "edit" ? t("users.passwordUnchanged") : ""
                          }
                          className={cls.mono}
                          aria-invalid={!!errors.password}
                          aria-describedby={
                            errors.password ? "ep-password-error" : undefined
                          }
                        />
                      </Flex>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title={t("endpoints.autoGenPassword")}
                        aria-label={t("endpoints.autoGenPassword")}
                        className={cls.generate}
                        onClick={() => setPassword(generatePassword())}
                      >
                        <RefreshCw size={16} />
                      </Button>
                    </HStack>
                    {fieldError("password")}
                    <VStack align="stretch" gap="4">
                      <HStack gap="4" align="center">
                        <Label htmlFor="ep-context" className={cls.fieldLabel}>
                          {t("endpoints.context")} *
                        </Label>
                        <InfoTooltip text={t("endpoints.contextDesc")} />
                      </HStack>
                      <Select
                        id="ep-context"
                        value={context}
                        onChange={(event) => chooseContext(event.target.value)}
                        required
                        aria-invalid={!!errors.context}
                        aria-describedby={
                          errors.context ? "ep-context-error" : undefined
                        }
                        options={[
                          { value: "", label: t("endpoints.selectContext"), disabled: true },
                          ...contexts.map((c) => ({
                            value: c.name,
                            label: c.comment
                              ? c.name + " (" + c.comment + ")"
                              : c.name,
                          })),
                        ]}
                      />
                      {fieldError("context")}
                    </VStack>
                  </VStack>
</ModalSection>
</VStack>
              </BasicSettings>

              <TabsContent value="network">
<ModalSection>
                <VStack align="stretch" gap="16">
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label htmlFor="ep-transport" className={cls.fieldLabel}>
                        {t("endpoints.transport")}
                      </Label>
                      <InfoTooltip text={t("endpoints.transportDesc")} />
                    </HStack>
                    <Select
                      id="ep-transport"
                      value={transport}
                      onChange={(event) => setTransport(event.target.value)}
                      options={TRANSPORT_OPTIONS.map((option) => ({
                        ...option,
                        label: option.value ? option.label : t(option.label),
                      }))}
                    />
                  </VStack>

                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>
                        {t("endpoints.natProfile")}
                      </Label>
                      <InfoTooltip text={t("endpoints.natDesc")} />
                    </HStack>
                    <HStack gap="8" wrap="wrap">
                      {PRIMARY_NAT_PROFILE_OPTIONS.map((p) => (
                        <Button
                          key={p.value}
                          type="button"
                          onClick={() => {
                            setNatProfile(p.value);
                            // Keep Advanced tab in sync with the chosen profile
                            const patch = buildNatProfilePatch(p.value);
                            setAdvancedState((prev) => {
                              const next = { ...prev };
                              for (const [key, val] of Object.entries(patch)) {
                                if (val == null) delete next[key];
                                else next[key] = val;
                              }
                              return next;
                            });
                          }}
                          variant={
                            natProfile === p.value ? "default" : "outline"
                          }
                          aria-pressed={natProfile === p.value}
                        >
                          {t(p.labelKey)}
                        </Button>
                      ))}
                    </HStack>
                  </VStack>

                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>
                        {t("endpoints.codecs")}
                      </Label>
                      <InfoTooltip text={t("endpoints.codecsDesc")} />
                    </HStack>
                    <Flex
                      wrap="wrap"
                      gap="8"
                      aria-invalid={!!errors.codecs}
                      aria-describedby={
                        errors.codecs ? "ep-codecs-error" : undefined
                      }
                    >
                      {CODEC_OPTIONS.map((codec) => (
                        <Button
                          key={codec}
                          type="button"
                          onClick={() => toggleCodec(codec)}
                          variant={
                            codecs.includes(codec) ? "default" : "outline"
                          }
                          size="sm"
                          className={cls.mono}
                          aria-pressed={codecs.includes(codec)}
                        >
                          {codec}
                        </Button>
                      ))}
                    </Flex>
                    {fieldError("codecs")}
                  </VStack>
                </VStack>
              </ModalSection>
</TabsContent>

              <TabsContent value="security">
<ModalSection>
                <VStack align="stretch" gap="16">
                  <HStack gap="4" align="center">
                    <Text as="h4" className={cls.securityTitle}>
                      {t("endpoints.ipFilterTitle")}
                    </Text>
                    <InfoTooltip text={t("endpoints.ipFilterDesc")} />
                  </HStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label htmlFor="ep-deny" className={cls.securityLabel}>
                        {t("endpoints.denyNetworks")}
                      </Label>
                      <InfoTooltip text={t("endpoints.denyNetworksHint")} />
                    </HStack>
                    <Input
                      id="ep-deny"
                      aria-invalid={!!errors.deny}
                      aria-describedby={
                        errors.deny ? "ep-deny-error" : undefined
                      }
                      value={deny}
                      onChange={(e) => setDeny(e.target.value)}
                      placeholder="192.168.1.0/24"
                      className={cls.mono}
                    />
                    {fieldError("deny")}
                  </VStack>

                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label htmlFor="ep-permit" className={cls.securityLabel}>
                        {t("endpoints.permitNetworks")}
                      </Label>
                      <InfoTooltip text={t("endpoints.permitNetworksHint")} />
                    </HStack>
                    <Input
                      id="ep-permit"
                      aria-invalid={!!errors.permit}
                      aria-describedby={
                        errors.permit ? "ep-permit-error" : undefined
                      }
                      value={permit}
                      onChange={(e) => setPermit(e.target.value)}
                      placeholder="192.168.1.0/24, 10.0.0.5/32"
                      className={cls.mono}
                    />
                    {fieldError("permit")}
                  </VStack>
                </VStack>
              </ModalSection>
</TabsContent>

              <TabsContent value="calls">
<ModalSection>
                <VStack align="stretch" gap="16">
                  <VStack align="stretch" gap="4">
                    <HStack gap="8" align="center">
                      <Switch
                        id="ep-blf"
                        checked={blfEnabled}
                        onCheckedChange={(checked) => setBlfEnabled(checked)
                        }
                      />
                      <Label htmlFor="ep-blf">
                        {t("endpoints.blfEnabled")}
                      </Label>
                      <InfoTooltip text={t("endpoints.blfDescription")} />
                    </HStack>
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Text as="span" className={cls.fieldLabel}>
                        {t("endpoints.namedCallGroup")}
                      </Text>
                      <InfoTooltip text={t("endpoints.namedCallGroupDesc")} />
                    </HStack>
                    <PickupGroupSelect
                      label=""
                      selectedSlugs={namedCallGroup}
                      onChange={setNamedCallGroup}
                    />
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Text as="span" className={cls.fieldLabel}>
                        {t("endpoints.namedPickupGroup")}
                      </Text>
                      <InfoTooltip text={t("endpoints.namedPickupGroupDesc")} />
                    </HStack>
                    <PickupGroupSelect
                      label=""
                      selectedSlugs={namedPickupGroup}
                      onChange={setNamedPickupGroup}
                    />
                  </VStack>
                </VStack>
              </ModalSection>
</TabsContent>

              <TabsContent value="provision">
<ModalSection>
                <VStack align="stretch" gap="16">
                  <HStack gap="12" className={cls.toggleRow} max>
                    <Switch
                      id="ep-provision"
                      checked={provisionEnabled}
                      onCheckedChange={(checked) => setProvisionEnabled(checked)
                      }
                    />
                    <HStack gap="4">
                      <Label htmlFor="ep-provision">
                        {t("endpoints.provEnable")}
                      </Label>
                      <InfoTooltip text={t("endpoints.provEnableHint")} />
                    </HStack>
                  </HStack>

                  {provisionEnabled && (
                    <>
                      <VStack align="stretch" gap="4">
                        <Label htmlFor="ep-mac" className={cls.fieldLabel}>
                          {t("endpoints.provMac")}
                        </Label>
                        <Input
                          id="ep-mac"
                          aria-invalid={!!errors.mac}
                          aria-describedby={
                            errors.mac ? "ep-mac-error" : undefined
                          }
                          value={macAddress}
                          onChange={(e) =>
                            setMacAddress(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-f0-9]/g, ""),
                            )
                          }
                          placeholder="a0b1c2d3e4f5"
                          className={cls.mac}
                        />
                        {fieldError("mac")}
                      </VStack>

                      <VStack align="stretch" gap="4">
                        <Label htmlFor="ep-tpl" className={cls.fieldLabel}>
                          {t("endpoints.provTemplate")}
                        </Label>
                        <Select
                          id="ep-tpl"
                          value={provisionTemplateId}
                          onChange={(event) =>
                            setProvisionTemplateId(
                              event.target.value
                                ? Number(event.target.value)
                                : "",
                            )
                          }
                          aria-invalid={!!errors.tpl}
                          aria-describedby={
                            errors.tpl ? "ep-tpl-error" : undefined
                          }
                          options={[
                            {
                              value: "",
                              label: t("endpoints.provTemplateSelect"),
                            },
                            ...templates.map((tpl) => ({
                              value: tpl.uid,
                              label: tpl.vendor
                                ? tpl.name + " (" + tpl.vendor + ")"
                                : tpl.name,
                            })),
                          ]}
                        />
                        {fieldError("tpl")}
                        {templates.length === 0 && (
                          <Text as="span" className={cls.warning}>
                            {t("endpoints.provTemplateEmpty")}
                          </Text>
                        )}
                      </VStack>

                      <VStack align="stretch" gap="4">
                        <Label htmlFor="ep-vars" className={cls.fieldLabel}>
                          {t("endpoints.provVars")}
                        </Label>
                        <Textarea
                          id="ep-vars"
                          value={pvVars}
                          onChange={(e) => setPvVars(e.target.value)}
                          placeholder={
                            "$custom_port=5062\n$button1_type=speeddial"
                          }
                          className={cls.variables}
                        />
                      </VStack>
                    </>
                  )}
                </VStack>
              </ModalSection>
</TabsContent>

              <TabsContent
                value="advanced"
                forceMount
                hidden={!expertMode || activeTab !== "advanced"}
              >
<ModalSection>
                {fieldError("advanced")}
                <AdvancedSettingsBuilder
                  value={advancedState}
                  onChange={setAdvancedState}
                  onValidationChange={setAdvancedValid}
                />
              </ModalSection>
</TabsContent>
            </ModalBody>
          </Tabs>

          {serverError && (
            <Text role="alert" className={cls.fieldError}>
              {serverError}
            </Text>
          )}
          <DialogFooter
            className={cls.footer}
            data-testid="endpoint-form-footer"
          >
            <HStack gap="8" justify="end" max className={cls.footerActions}>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button
                data-testid="endpoint-save"
                type="submit"
                disabled={isLoading}
              >
                {isLoading && <Loader2 size={16} className={cls.spinner} />}
                {isLoading ? t("common.loading") : t("common.save")}
              </Button>
            </HStack>
          </DialogFooter>
        </Flex>
      </FormDialogContent>
    </Dialog>
  );
};
