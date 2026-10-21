import { useAutodialConfirmation } from '../AutodialConfirmation/useAutodialConfirmation';
import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { ModalBody, ModalSection } from '@/shared/ui';
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { AUTODIAL_DIAL_MODES } from "@krasterisk/shared";
import {
  Button,
  Dialog,
  FormDialogContent,
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
import { CampaignCreationWizard } from './CampaignCreationWizard';
import { useCreateCommand, uncertainAutodialSave } from '../../model/useCreateCommand';
import { CreateCommandStatus } from '../CreateCommandStatus/CreateCommandStatus';
import { campaignDraftSessionKey, readCampaignDraft, removeCampaignDraft, writeCampaignDraft } from '../../model/campaignDraftSession';

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
  amd: "general",
  pacing: "pacing",
  predictive: "pacing",
  trunk_pool: "trunks",
  scenario_actions: "scenario",
  schedules: 'schedule',
  retry: 'retry',
};

export const CampaignFormModal = memo(() => {
  const { t } = useTranslation();
  const { confirm, confirmationDialog } = useAutodialConfirmation();
  const dialogFocus = useAutodialDialogFocus();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isOpen = useAppSelector(selectAutodialCampaignModalOpen);
  const mode = useAppSelector(selectAutodialCampaignModalMode);
  const uid = useAppSelector(selectAutodialSelectedCampaignUid);
  const user = useAppSelector((state) => state.auth?.user);
  const draftKey = user?.uniqueid && mode !== 'edit' ? campaignDraftSessionKey(user.vpbx_user_uid, user.uniqueid, `${mode}:${uid ?? 'new'}`) : null;
  const command = useCreateCommand<AutodialCampaignDraft, ReturnType<typeof draftToPayload>>('campaign', `${mode}:${uid ?? 'new'}`);

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
  const [restored, setRestored] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);
  const [localDraftSaved, setLocalDraftSaved] = useState<boolean | null>(null);
  const hydratedSession = useRef<string | null>(null);
  const baseline = useRef('');

  useEffect(() => {
    if (!isOpen) {
      hydratedSession.current = null;
      return;
    }
    const session = `${mode}:${uid ?? "create"}:${mode === 'edit' ? '' : command.pending?.id ?? ''}`;
    if (hydratedSession.current === session) return;
    setTab("general");
    setShowErrors(false);
    setApiError(null);
    setRestored(false);
    setLocalDraftSaved(null);
    if (uid === null || mode === 'copy' && command.pending) {
      const stored = readCampaignDraft(draftKey);
      const initial = command.pending?.draft ?? stored ?? emptyCampaignDraft(); setDraft(initial); baseline.current = JSON.stringify(initial);
      setRestored(Boolean(stored && !command.pending));
      hydratedSession.current = session;
    } else if (campaign) {
      const next = campaignToDraft(campaign);
      const stored = mode === 'copy' ? readCampaignDraft(draftKey) : null;
      setDraft(
        stored ?? (mode === "copy"
          ? {
              ...next,
              name: t("autodial.form.copySuffix", { name: next.name }),
            }
          : next),
      );
      setRestored(Boolean(stored));
      baseline.current = JSON.stringify(mode === 'copy' ? { ...next, name: t('autodial.form.copySuffix', { name: next.name }) } : next);
      hydratedSession.current = session;
    }
  }, [isOpen, uid, campaign, mode, t, command.pending, draftKey]);

  const changeDraft = (next: AutodialCampaignDraft) => {
    setDraft(next);
    if (mode !== 'edit' && !command.pending) setLocalDraftSaved(writeCampaignDraft(draftKey, next));
  };

  const errors = useMemo(() => validateCampaignDraft(draft), [draft]);
  const isBlocked = hasCampaignErrors(errors);
  const isSaving = isCreating || isUpdating || command.busy;

  const close = async (force = false) => {
    if (!force && command.pending && !(await confirm(t('autodial.workspace.commandCloseHint')))) return;
    if (!force && JSON.stringify(draft) !== baseline.current && !(await confirm(t(mode !== 'edit' && localDraftSaved ? 'autodial.workspace.localDraftClose' : 'autodial.workspace.discard')))) return;
    dispatch(autodialPageActions.closeCampaignModal());
  };

  const onSave = async (openStart = false) => {
    if (isSaving) return;
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
        const created = await command.run(draft, payload, (body, id) => createCampaign({ ...body, ui_command_id: id }).unwrap());
        if (created?.uid) navigate(`/autodial/campaigns/${created.uid}${openStart ? '?start=1' : ''}`);
      }
      removeCampaignDraft(draftKey);
      close(true);
    } catch (error) {
      setApiError(uncertainAutodialSave(error) ? mode === 'edit' ? t('autodial.workspace.updateUncertain') : null
        : t(autodialErrorKey(error, "autodial.form.saveFailed")));
    }
  };

  const title =
    mode === "edit"
      ? t("autodial.form.editTitle")
      : mode === "copy"
        ? t("autodial.form.copyTitle")
        : t("autodial.form.createTitle");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && close()}>
      {confirmationDialog}
      <FormDialogContent
        {...dialogFocus}
        size="large"
        className={cls.dialog}
        data-testid="autodial-campaign-form-modal"
       aria-describedby={undefined}>
        <DialogHeader className={cls.header}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {isFetching && uid !== null ? (
          <HStack justify="center" align="center" className={cls.body}>
            <Loader2 size={24} className={cls.spinner} />
          </HStack>
        ) : mode !== 'edit' ? <CampaignCreationWizard key={`${mode}:${uid ?? 'new'}:${isOpen}:${draftVersion}`} draft={draft} onChange={changeDraft}
          draftKey={draftKey} onDiscard={async () => {
            if (command.pending || isSaving || !(await confirm(t('autodial.workspace.clearLocalDraftConfirm')))) return;
            removeCampaignDraft(draftKey);
            const next = mode === 'copy' && campaign ? { ...campaignToDraft(campaign), name: t('autodial.form.copySuffix', { name: campaign.name }) } : emptyCampaignDraft();
            setDraft(next); baseline.current = JSON.stringify(next); setRestored(false); setLocalDraftSaved(null); setApiError(null);
            setDraftVersion((value) => value + 1);
          }}
          onSave={onSave} onClose={() => close()} saving={isSaving} apiError={apiError} locked={Boolean(command.pending)}
          commandStatus={<>{(restored || localDraftSaved !== null) && <Text variant="muted" role="status">{t(restored ? 'autodial.workspace.localDraftRestored' : localDraftSaved ? 'autodial.workspace.localDraftSaved' : 'autodial.workspace.localDraftUnavailable')}</Text>}<CreateCommandStatus pending={Boolean(command.pending)} busy={command.busy} slow={command.slow} onCheck={() => {
            void command.check().then((saved) => {
              if (saved) { removeCampaignDraft(draftKey); navigate(`/autodial/campaigns/${saved}`); close(true); }
              else setApiError(t('autodial.workspace.commandStillUnknown'));
            }).catch(() => setApiError(t('autodial.workspace.commandCheckFailed')));
          }} /></>} /> : (
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

            <ModalBody
              className={cls.body}
              data-testid="autodial-campaign-form-body"
              data-viewport="360,768,1440"
              data-overflow="y"
            >
              <TabsContent value="general">
<ModalSection>
                <CampaignGeneralTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                  dialModeOptions={AUTODIAL_DIAL_MODES.map((m) => ({
                    value: m,
                    label: autodialDialModeLabel(m, t),
                  }))}
                />
              </ModalSection>
</TabsContent>
              <TabsContent value="pacing">
<ModalSection>
                <CampaignPacingTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                />
              </ModalSection>
</TabsContent>
              <TabsContent value="retry">
<ModalSection>
                <CampaignRetryTab draft={draft} onChange={setDraft} />
              </ModalSection>
</TabsContent>
              <TabsContent value="trunks">
<ModalSection>
                <CampaignTrunksTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                />
              </ModalSection>
</TabsContent>
              <TabsContent value="schedule">
<ModalSection>
                <CampaignScheduleTab draft={draft} onChange={setDraft} />
              </ModalSection>
</TabsContent>
              <TabsContent value="scenario">
<ModalSection>
                <CampaignScenarioTab
                  draft={draft}
                  onChange={setDraft}
                  errors={showErrors ? errors : {}}
                />
              </ModalSection>
</TabsContent>
              <TabsContent value="dnc">
<ModalSection>
                <CampaignDncTab
                  campaignUid={mode === "edit" ? uid : null}
                  baseUid={draft.base_uid}
                />
              </ModalSection>
</TabsContent>
            </ModalBody>
          </Tabs>
        )}

        {mode === 'edit' && <DialogFooter
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
              <Button variant="outline" onClick={() => close()}>
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
        </DialogFooter>}
      </FormDialogContent>
    </Dialog>
  );
});

CampaignFormModal.displayName = "CampaignFormModal";
