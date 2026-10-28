import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetCardTemplatesQuery,
  useLazyClientLookupQuery,
  useLazyGetCardByCallQuery,
} from '@/shared/api/endpoints/callCenterApi';
import {
  selectMyAgent,
  selectCcCalls,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import type { ICardTemplate } from '@/features/callcenter/model/types/callCard';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

export interface CallCardContext {
  uniqueid: string;
  callerId: string;
  queue: string;
}

export function resolveTemplate(templates: ICardTemplate[], queue: string): ICardTemplate | null {
  return templates.find(
    (tpl) => tpl.is_active && (tpl.queue_names ?? []).includes(queue),
  ) ?? templates.find((tpl) => tpl.is_active && !(tpl.queue_names ?? []).length) ?? null;
}

/** Compare complete dial targets; never match extensions by suffix across tenants. */
export function sameDialTarget(left?: string | null, right?: string | null): boolean {
  const normalize = (value: string) => value.trim().replace(/[\s().-]/g, '').replace(/^\+/, '');
  return Boolean(left && right && normalize(left) === normalize(right));
}

function shouldAutoOpen(
  autoOpenOn: ICardTemplate['auto_open_on'],
  agentStatus: string | undefined,
  callStatus: string | undefined,
): boolean {
  if (autoOpenOn === 'manual') return false;
  if (autoOpenOn === 'ring') {
    return agentStatus === 'RINGING' || callStatus === 'RINGING';
  }
  return agentStatus === 'IN_CALL' || callStatus === 'TALKING' || callStatus === 'HOLD';
}

function buildAutoPopulateValues(
  template: ICardTemplate,
  call: CallCardContext,
  phonebookName: string,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of template.fields ?? []) {
    const key = field.auto_populate;
    if (!key) continue;

    if (key === 'caller_id') {
      values[field.field_key] = call.callerId;
    } else if (key === 'queue') {
      values[field.field_key] = call.queue;
    } else if (key.startsWith('phonebook.')) {
      const varName = key.slice('phonebook.'.length);
      if (varName === 'name') {
        values[field.field_key] = phonebookName;
      }
    }
  }

  for (const field of template.fields ?? []) {
    if (values[field.field_key] === undefined && field.default_value) {
      values[field.field_key] = field.default_value;
    }
  }

  return values;
}

export function useCallCardPopup({ outboundContext }: { outboundContext?: { target: string; queue: string } | null } = {}) {
  const { t } = useTranslation();
  const myAgent = useSelector(selectMyAgent);
  const calls = useSelector(selectCcCalls);
  const { data: templates = [] } = useGetCardTemplatesQuery();
  const [triggerLookup] = useLazyClientLookupQuery();
  const [loadSavedCard] = useLazyGetCardByCallQuery();
  const requestRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [template, setTemplate] = useState<ICardTemplate | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [callContext, setCallContext] = useState<CallCardContext | null>(null);
  const [isVip, setIsVip] = useState(false);
  const openedForRef = useRef<string | null>(null);

  const activeCall: ICall | null = useMemo(() => {
    if (!myAgent) return null;
    if (!['IN_CALL', 'RINGING', 'DIALING', 'CONSULT'].includes(myAgent.status)) return null;
    if (myAgent.currentCall) {
      const bound = calls.find((c) => c.uniqueid === myAgent.currentCall);
      if (bound) return outboundContext && sameDialTarget(myAgent.dialTarget, outboundContext.target)
        ? { ...bound, queue: outboundContext.queue } : bound;
    }
    if (myAgent.directCallUniqueid && ['IN_CALL', 'RINGING', 'DIALING', 'CONSULT'].includes(myAgent.status)) {
      return {
        uniqueid: myAgent.directCallUniqueid, queue: outboundContext && sameDialTarget(myAgent.dialTarget, outboundContext.target) ? outboundContext.queue : '', agent: myAgent.interface,
        callerIdNum: myAgent.dialTarget || myAgent.peerNumber || '', callerIdName: '',
        status: myAgent.status === 'IN_CALL' || myAgent.status === 'CONSULT' ? 'TALKING' : 'RINGING',
        enterTime: myAgent.statusSince || new Date().toISOString(), holdTime: 0, talkTime: 0, userUid: myAgent.userUid,
      };
    }
    return (
      calls.find(
        (c) => c.status === 'RINGING' && c.agent === myAgent.interface,
      ) ?? null
    );
  }, [myAgent, calls, outboundContext]);

  const populateAndOpen = useCallback(async (tpl: ICardTemplate, call: CallCardContext) => {
    const request = ++requestRef.current;
    setOpen(false);
    setTemplate(tpl);
    setCallContext(call);
    let savedValues: Record<string, unknown> = {};
    try {
      const saved = await loadSavedCard(call.uniqueid).unwrap();
      if (saved.template_id === tpl.uid) savedValues = saved.field_values ?? {};
    } catch (error) {
      if ((error as { status?: number })?.status !== 404) {
        if (request === requestRef.current) toast.error(t('callcenter.reports.cardUnavailable', 'Unable to load call card. Check access and try again.'));
        return;
      }
    }
    let phonebookName = '';
    let vip = false;

    try {
      const needsPhonebook = (tpl.fields ?? []).some(
        (f) => f.auto_populate?.startsWith('phonebook.'),
      );
      if (needsPhonebook && call.callerId) {
        const result = await triggerLookup(call.callerId).unwrap();
        vip = result.matched && result.contacts.length > 0;
        phonebookName = result.contacts[0]?.comment || result.contacts[0]?.number || '';
        if (result.contacts[0]?.values?.name) {
          phonebookName = result.contacts[0].values.name;
        }
      }
    } catch {
      // Lookup failure must not block card open
    }

    if (request !== requestRef.current) return;
    setInitialValues({ ...buildAutoPopulateValues(tpl, call, phonebookName), ...savedValues });
    setIsVip(vip);
    setOpen(true);
  }, [triggerLookup, loadSavedCard, t]);

  useEffect(() => {
    if (!myAgent) {
      requestRef.current += 1;
      setOpen(false);
      setTemplate(null);
      setCallContext(null);
      openedForRef.current = null;
      return;
    }

    if (!activeCall) {
      // callEnd precedes agentUpdate(WRAPUP). Keep the current form through
      // that event gap so answers remain editable during after-call work.
      if (!['WRAPUP', 'IN_CALL', 'CONSULT', 'RINGING', 'DIALING'].includes(myAgent.status)) {
        if (!manualOpen) {
          requestRef.current += 1;
          setOpen(false);
          setTemplate(null);
          setCallContext(null);
        }
        openedForRef.current = null;
      }
      return;
    }

    const tpl = resolveTemplate(templates, activeCall.queue);
    if (!tpl) {
      if (!manualOpen) setOpen(false);
      return;
    }

    const auto = shouldAutoOpen(tpl.auto_open_on, myAgent.status, activeCall.status);
    if (!auto && !manualOpen) return;

    if (openedForRef.current === activeCall.uniqueid) return;

    const ctx: CallCardContext = {
      uniqueid: activeCall.uniqueid,
      callerId: activeCall.callerIdNum,
      queue: activeCall.queue,
    };

    openedForRef.current = activeCall.uniqueid;
    void populateAndOpen(tpl, ctx);
  }, [activeCall, myAgent, templates, manualOpen, populateAndOpen]);

  const openManually = useCallback(() => {
    if (!activeCall) return;
    const tpl = resolveTemplate(templates, activeCall.queue);
    if (!tpl) return;
    setManualOpen(true);
    const ctx: CallCardContext = {
      uniqueid: activeCall.uniqueid,
      callerId: activeCall.callerIdNum,
      queue: activeCall.queue,
    };
    openedForRef.current = activeCall.uniqueid;
    void populateAndOpen(tpl, ctx);
  }, [activeCall, templates, populateAndOpen]);

  const close = useCallback(() => {
    requestRef.current += 1;
    setOpen(false);
    setManualOpen(false);
  }, []);

  return {
    open,
    template,
    availableTemplate: activeCall ? resolveTemplate(templates, activeCall.queue) : null,
    initialValues,
    callContext,
    isVip,
    openManually,
    close,
    activeCall,
    agentStatus: myAgent?.status,
  };
}
