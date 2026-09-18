import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { AUTODIAL_DIAL_MODES } from "@krasterisk/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from "@/shared/ui";
import { HStack, VStack } from "@/shared/ui/Stack";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/useAppStore";
import {
  useCreateAutodialCampaignMutation,
  useGetAutodialCampaignQuery,
  useUpdateAutodialCampaignMutation,
} from "@/shared/api/endpoints/autodialApi";
import {
  autodialPageActions,
  selectAutodialCampaignModalMode,
  selectAutodialCampaignModalOpen,
  selectAutodialSelectedCampaignUid,
} from "../../model/slice/autodialPageSlice";
import {
  campaignToDraft,
  draftToPayload,
  emptyCampaignDraft,
  hasCampaignErrors,
  validateCampaignDraft,
  type AutodialCampaignDraft,
} from "../../model/campaignDraft";
import { autodialDialModeLabel } from "../../lib/labels";
import { autodialErrorKey } from "../../lib/mutationError";
import { CampaignGeneralTab } from "./CampaignGeneralTab";
import { CampaignPacingTab } from "./CampaignPacingTab";
import { CampaignRetryTab } from "./CampaignRetryTab";
import { CampaignTrunksTab } from "./CampaignTrunksTab";
import { CampaignScheduleTab } from "./CampaignScheduleTab";
import { CampaignScenarioTab } from "./CampaignScenarioTab";
import { CampaignDncTab } from "./CampaignDncTab";
import cls from "./CampaignFormModal.module.scss";

type TabId =
  | "general"
  | "pacing"
  | "retry"
  | "trunks"
  | "schedule"
  | "scenario"
  | "dnc";

const TABS: Array<{ id: TabId; labelKey: string }> = [
  { id: "general", labelKey: "autodial.form.tabs.general" },
  { id: "pacing", labelKey: "autodial.form.tabs.pacing" },
  { id: "retry", labelKey: "autodial.form.tabs.retry" },
  { id: "trunks", labelKey: "autodial.form.tabs.trunks" },
  { id: "schedule", labelKey: "autodial.form.tabs.schedule" },
  { id: "scenario", labelKey: "autodial.form.tabs.scenario" },
  { id: "dnc", labelKey: "autodial.form.tabs.dnc" },
];

/** Which tab holds each validation error, so a blocked save can point at it. */
const ERROR_TAB: Record<string, TabId> = {
  name: "general",
  base_uid: "general",
  queue_names: "general",
  pacing: "pacing",
  predictive: "pacing",
  trunk_pool: "trunks",
  scenario_actions: "scenario",
};

export const CampaignFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectAutodialCampaignModalOpen);
  const mode = useAppSelector(selectAutodialCampaignModalMode);
  const uid = useAppSelector(selectAutodialSelectedCampaignUid);

  const { data: campaign, isFetching } = useGetAutodialCampaignQuery(
    uid as number,
    {
      skip: !isOpen || uid === null,
    },
  );
  const [createCampaign, { isLoading: isCreating }] =
    useCreateAutodialCampaignMutation();
  const [updateCampaign, { isLoading: isUpdating }] =
    useUpdateAutodialCampaignMutation();

  const [draft, setDraft] = useState<AutodialCampaignDraft>(emptyCampaignDraft);
  const [tab, setTab] = useState<TabId>("general");
  const [showErrors, setShowErrors] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const hydratedSession = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      hydratedSession.current = null;
      return;
    }
    const session = `${mode}:${uid ?? "create"}`;
    if (hydratedSession.current === session) return;
    setTab("general");
    setShowErrors(false);
    setApiError(null);
    if (uid === null) {
      setDraft(emptyCampaignDraft());
      hydratedSession.current = session;
    } else if (campaign) {
      const next = campaignToDraft(campaign);
      setDraft(
        mode === "copy"
          ? {
              ...next,
              name: t("autodial.form.copySuffix", { name: next.name }),
            }
          : next,
      );
      hydratedSession.current = session;
    }
  }, [isOpen, uid, campaign, mode, t]);

  const errors = useMemo(() => validateCampaignDraft(draft), [draft]);
  const isBlocked = hasCampaignErrors(errors);
  const isSaving = isCreating || isUpdating;

  const close = () => dispatch(autodialPageActions.closeCampaignModal());

  const onSave = async () => {
    if (isBlocked) {
      setShowErrors(true);
      const firstErrorKey = Object.keys(errors)[0];
      setTab(ERROR_TAB[firstErrorKey] ?? "general");
      return;
    }
    setApiError(null);
    const payload = draftToPayload(draft);
    try {
      if (mode === "edit" && uid !== null) {
        await updateCampaign({
          uid,
          data: {
            ...payload,
            expected_revision: draft.revision ?? campaign?.revision ?? 0,
          },
        }).unwrap();
      } else {
        await createCampaign(payload).unwrap();
      }
      close();
    } catch (error) {
      setApiError(t(autodialErrorKey(error, "autodial.form.saveFailed")));
    }
  };

  const title =
    mode === "edit"
      ? t("autodial.form.editTitle")
      : mode === "copy"
        ? t("autodial.form.copyTitle")
        : t("autodial.form.createTitle");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        size="large"
        className={cls.dialog}
        data-testid="autodial-campaign-form-modal"
      >
        <DialogHeader className={cls.header}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {isFetching && uid !== null ? (
          <HStack justify="center" align="center" className={cls.body}>
            <Loader2 size={24} className={cls.spinner} />
          </HStack>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabId)}
            className={cls.tabs}
          >
            <TabsList>
              {TABS.map(({ id, labelKey }) => (
                <TabsTrigger key={id} value={id}>
                  {t(labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div
              className={cls.body}
              data-testid="autodial-campaign-form-body"
              data-viewport="360,768,1440"
              data-overflow="y"
            >
              <TabsContent value="general">
                <CampaignGeneralTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                  dialModeOptions={AUTODIAL_DIAL_MODES.map((m) => ({
                    value: m,
                    label: autodialDialModeLabel(m, t),
                  }))}
                />
              </TabsContent>
              <TabsContent value="pacing">
                <CampaignPacingTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                />
              </TabsContent>
              <TabsContent value="retry">
                <CampaignRetryTab draft={draft} onChange={setDraft} />
              </TabsContent>
              <TabsContent value="trunks">
                <CampaignTrunksTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                />
              </TabsContent>
              <TabsContent value="schedule">
                <CampaignScheduleTab draft={draft} onChange={setDraft} />
              </TabsContent>
              <TabsContent value="scenario">
                <CampaignScenarioTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                />
              </TabsContent>
              <TabsContent value="dnc">
                <CampaignDncTab campaignUid={mode === "edit" ? uid : null} />
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter
          className={cls.footer}
          data-testid="autodial-campaign-form-footer"
        >
          <VStack gap="8" max align="end">
            {apiError && <Text className={cls.error}>{apiError}</Text>}
            <HStack
              gap="8"
              justify="end"
              max
              wrap="wrap"
              className={cls.footerActions}
            >
              <Button variant="outline" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button disabled={isSaving} onClick={() => void onSave()}>
                {isSaving ? (
                  <Loader2 size={16} className={cls.spinner} />
                ) : null}
                {t("common.save")}
              </Button>
            </HStack>
          </VStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

CampaignFormModal.displayName = "CampaignFormModal";
