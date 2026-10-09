import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  PasswordInput,
  Select,
  Checkbox,
  Label,
  InfoTooltip,
  Text,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Flex,
  VStack,
  HStack,
} from "@/shared/ui";
import { useAppSelector, useAppDispatch } from "@/shared/hooks/useAppStore";
import { selectEndpointIsBulkModalOpen } from "../../model/selectors/endpointsPageSelectors";
import { endpointsPageActions } from "../../model/slice/endpointsPageSlice";
import {
  useBulkCreateEndpointsMutation,
  useGetBulkJobStatusQuery,
  useGetActiveBulkJobQuery,
} from "@/shared/api/endpoints/endpointApi";
import { rtkApi } from "@/shared/api/rtkApi";
import { useGetContextsQuery } from "@/shared/api/endpoints/contextApi";
import {
  PRIMARY_NAT_PROFILE_OPTIONS,
  type PrimaryNatProfileId,
} from "../../config/natProfiles";
import {
  apiErrorMessage,
  parseExtensionPattern,
  jobProgress,
} from "../../lib/formValidation";
import type { IBulkCreateResult } from "@krasterisk/shared";
import cls from "./BulkCreateModal.module.scss";
import { useDefaultContext } from "@/shared/lib/useDefaultContext";

export const BulkCreateModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectEndpointIsBulkModalOpen);
  const [bulkCreate, { isLoading }] = useBulkCreateEndpointsMutation();
  const { data: contexts = [] } = useGetContextsQuery();
  const { data: activeJobData } = useGetActiveBulkJobQuery(undefined, {
    skip: !isOpen,
    refetchOnMountOrArgChange: true,
  });
  const [extensionsPattern, setExtensionsPattern] = useState("");
  const [passwordPattern, setPasswordPattern] = useState("auto");
  const [department, setDepartment] = useState("");
  const [context, setContext] = useState("");
  const [natProfile, setNatProfile] = useState<PrimaryNatProfileId>("nat");
  const [webrtcEnabled, setWebrtcEnabled] = useState(false);
  const [result, setResult] = useState<IBulkCreateResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    data: jobStatus,
    isError: isJobStatusError,
    error: jobStatusError,
  } = useGetBulkJobStatusQuery(jobId || "", {
    skip: !isOpen || !jobId,
    pollingInterval: 1000,
  });

  useEffect(() => {
    if (isOpen && activeJobData?.jobId && !jobId && !result && !error)
      setJobId(activeJobData.jobId);
  }, [isOpen, activeJobData, jobId, result, error]);

  const handleClose = useCallback(() => {
    dispatch(endpointsPageActions.closeBulkModal());
    setResult(null);
    setJobId(null);
    setError("");
    setErrors({});
  }, [dispatch]);

  useEffect(() => {
    if (!isOpen || !jobId || !jobStatus || jobStatus.id !== jobId) return;
    if (jobStatus.status === "completed" || jobStatus.status === "error") {
      setResult({
        created: jobStatus.created,
        skipped: jobStatus.skipped,
        total: jobStatus.total,
      });
      setError(
        jobStatus.status === "error"
          ? jobStatus.error || t("endpoints.bulkError")
          : "",
      );
      setJobId(null);
      dispatch(rtkApi.util.invalidateTags([{ type: "Endpoints", id: "LIST" }]));
    }
  }, [isOpen, jobId, jobStatus, dispatch, t]);

  useEffect(() => {
    if (!isOpen || !jobId) return;
    if (!isJobStatusError) {
      if (
        jobStatus?.id === jobId &&
        jobStatus.status !== "error" &&
        jobStatus.status !== "completed"
      )
        setError("");
      return;
    }
    const status =
      jobStatusError && "status" in jobStatusError
        ? jobStatusError.status
        : undefined;
    setError(
      status === 404
        ? t("endpoints.jobNotFound")
        : apiErrorMessage(jobStatusError, t("endpoints.jobStatusError")),
    );
    if (status === 404) setJobId(null);
  }, [isOpen, isJobStatusError, jobStatusError, jobStatus, jobId, t]);

  const parsed = parseExtensionPattern(extensionsPattern);
  const chooseContext = useDefaultContext(isOpen, true, contexts, "endpoints", setContext);

  const handleSubmit = async () => {
    if (isSubmitting || isLoading || jobId) return;
    const next: Record<string, string> = {};
    if (parsed.error) next.pattern = parsed.error;
    if (!context) next.context = "endpoints.required";
    if (passwordPattern !== "auto" && passwordPattern.length < 4)
      next.password = "endpoints.passwordMinimum";
    setErrors(next);
    setError("");
    if (Object.keys(next).length) return;
    setIsSubmitting(true);
    try {
      const response = await bulkCreate({
        extensionsPattern: extensionsPattern.trim(),
        passwordPattern,
        department: department || undefined,
        context,
        codecs: "ulaw,alaw,g722",
        natProfile,
        webrtcEnabled,
      }).unwrap();
      if (response.jobId) setJobId(response.jobId);
      else setResult(response);
    } catch (failure: unknown) {
      setError(apiErrorMessage(failure, t("endpoints.bulkError")));
    } finally {
      setIsSubmitting(false);
    }
  };
  const fieldError = (key: string) =>
    errors[key] ? (
      <Text id={`bulk-${key}-error`} className={cls.error} role="alert">
        {t(errors[key])}
      </Text>
    ) : null;
  const busy = isSubmitting || isLoading;
  const progress = jobProgress(
    jobStatus?.processed ?? 0,
    jobStatus?.total ?? 0,
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !busy && handleClose()}
    >
      <DialogContent
        size="large"
        className={cls.dialog}
        aria-describedby={undefined}
      >
        <DialogHeader className={cls.header}>
          <HStack gap="8">
            <Layers size={20} className={cls.icon} />
            <DialogTitle>{t("endpoints.bulkTitle")}</DialogTitle>
          </HStack>
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
          <VStack gap="16" className={cls.body} max align="stretch">
            {error && (
              <Text role="alert" className={cls.error}>
                {error}
              </Text>
            )}
            {jobId ? (
              <VStack gap="16" max align="stretch">
                <Text className={cls.primary}>
                  {t("endpoints.bulkWorking")}
                </Text>
                <Flex
                  role="progressbar"
                  aria-label={t("endpoints.bulkWorking")}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className={cls.track}
                >
                  <Flex
                    className={cls.fill}
                    style={{ width: `${progress}%` }}
                  />
                </Flex>
                <Text variant="muted">
                  {progress}% ({jobStatus?.processed ?? 0} /{" "}
                  {jobStatus?.total ?? 0})
                </Text>
                <InfoTooltip text={t("endpoints.bulkBackground")} />
              </VStack>
            ) : result ? (
              <VStack gap="12" max align="stretch">
                {!error && (
                  <Text className={cls.success}>{t("common.success")}</Text>
                )}
                <Text>
                  {t("endpoints.bulkCreated", {
                    count: result.created?.length ?? result.total,
                  })}
                </Text>
                {!!result.skipped?.length && (
                  <Text className={cls.warning}>
                    {t("endpoints.bulkSkipped", {
                      count: result.skipped.length,
                    })}
                  </Text>
                )}
              </VStack>
            ) : (
              <>
                <VStack gap="8" max>
                  <HStack gap="4">
                    <Label htmlFor="bulk-pattern" className={cls.label}>
                      {t("endpoints.bulkExtensionsPattern")} *
                    </Label>
                    <InfoTooltip text={t("endpoints.bulkRangeHint")} />
                  </HStack>
                  <Input
                    id="bulk-pattern"
                    className={cls.mono}
                    value={extensionsPattern}
                    onChange={(event) =>
                      setExtensionsPattern(event.target.value)
                    }
                    placeholder="101,106,110-120"
                    aria-invalid={!!errors.pattern}
                    aria-describedby={
                      errors.pattern ? "bulk-pattern-error" : undefined
                    }
                  />
                  {fieldError("pattern")}
                  {!parsed.error && (
                    <Text variant="muted">
                      {t("endpoints.bulkPlanned", {
                        count: parsed.extensions.length,
                      })}
                    </Text>
                  )}
                </VStack>
                <VStack gap="8" max>
                  <HStack gap="4">
                    <Label htmlFor="bulk-password" className={cls.label}>
                      {t("endpoints.bulkPasswordPattern")} *
                    </Label>
                    <InfoTooltip text={t("endpoints.bulkPasswordAuto")} />
                  </HStack>
                  <PasswordInput
                    id="bulk-password"
                    value={passwordPattern}
                    onChange={(event) => setPasswordPattern(event.target.value)}
                    placeholder="auto"
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "bulk-password-error" : undefined
                    }
                  />
                  {fieldError("password")}
                </VStack>
                <VStack gap="8" max>
                  <HStack gap="4">
                    <Label htmlFor="bulk-dept" className={cls.label}>
                      {t("endpoints.department")}
                    </Label>
                    <InfoTooltip text={t("endpoints.bulkDepartmentHint")} />
                  </HStack>
                  <Input
                    id="bulk-dept"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder={t("endpoints.departmentPlaceholder")}
                  />
                </VStack>
                <VStack gap="8" max>
                  <HStack gap="4">
                    <Label htmlFor="bulk-context" className={cls.label}>
                      {t("endpoints.context")} *
                    </Label>
                    <InfoTooltip text={t("endpoints.contextDesc")} />
                  </HStack>
                  <Select
                    id="bulk-context"
                    value={context}
                    onChange={(event) => chooseContext(event.target.value)}
                    required
                    aria-invalid={!!errors.context}
                    aria-describedby={
                      errors.context ? "bulk-context-error" : undefined
                    }
                    options={[
                      { value: "", label: t("endpoints.selectContext"), disabled: true },
                      ...contexts.map((item) => ({
                        value: item.name,
                        label: item.name,
                      })),
                    ]}
                  />
                  {fieldError("context")}
                </VStack>
                <VStack gap="8" max>
                  <HStack gap="4">
                    <Text className={cls.label}>
                      {t("endpoints.natProfile")}
                    </Text>
                    <InfoTooltip text={t("endpoints.natDesc")} />
                  </HStack>
                  <HStack gap="8" wrap="wrap">
                    {PRIMARY_NAT_PROFILE_OPTIONS.map((profile) => (
                      <Button
                        type="button"
                        key={profile.value}
                        variant={
                          natProfile === profile.value ? "default" : "outline"
                        }
                        aria-pressed={natProfile === profile.value}
                        onClick={() => setNatProfile(profile.value)}
                      >
                        {t(profile.labelKey)}
                      </Button>
                    ))}
                  </HStack>
                </VStack>
                <HStack gap="8" className={cls.toggle}>
                  <Checkbox
                    id="bulk-webrtc"
                    checked={webrtcEnabled}
                    onChange={(event) => setWebrtcEnabled(event.target.checked)}
                  />
                  <Label htmlFor="bulk-webrtc">
                    {t("endpoints.webrtcClient")}
                  </Label>
                  <InfoTooltip text={t("endpoints.webrtcClientHint")} />
                </HStack>
              </>
            )}
          </VStack>
          <DialogFooter className={cls.footer}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={busy}
            >
              {t(result || jobId ? "common.close" : "common.cancel")}
            </Button>
            {!result && !jobId && (
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 size={16} className={cls.spinner} />}
                {busy ? t("common.loading") : t("common.add")} (
                {parsed.extensions.length})
              </Button>
            )}
          </DialogFooter>
        </Flex>
      </DialogContent>
    </Dialog>
  );
};
