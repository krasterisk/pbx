import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetCardTemplatesQuery,
  useLazyClientLookupQuery,
} from '@/shared/api/endpoints/callCenterApi';
import {
  selectMyAgent,
  selectCcCalls,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import type { ICardTemplate } from '@/features/callcenter/model/types/callCard';
import type { ICall } from '@/features/callcenter/model/types/callCenterSchema';

export interface CallCardContext {
  uniqueid: string;
  callerId: string;
  queue: string;
}

function resolveTemplate(templates: ICardTemplate[], queue: string): ICardTemplate | null {
  return templates.find(
    (tpl) => tpl.is_active && (tpl.queue_names ?? []).includes(queue),
  ) ?? null;
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

export function useCallCardPopup() {
  const myAgent = useSelector(selectMyAgent);
  const calls = useSelector(selectCcCalls);
  const { data: templates = [] } = useGetCardTemplatesQuery();
  const [triggerLookup] = useLazyClientLookupQuery();

  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [template, setTemplate] = useState<ICardTemplate | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [callContext, setCallContext] = useState<CallCardContext | null>(null);
  const [isVip, setIsVip] = useState(false);
  const openedForRef = useRef<string | null>(null);

  const activeCall: ICall | null = useMemo(() => {
    if (!myAgent) return null;
    if (myAgent.currentCall) {
      const bound = calls.find((c) => c.uniqueid === myAgent.currentCall);
      if (bound) return bound;
    }
    return (
      calls.find(
        (c) => c.status === 'RINGING' && c.agent === myAgent.interface,
      ) ?? null
    );
  }, [myAgent, calls]);

  const populateAndOpen = useCallback(async (tpl: ICardTemplate, call: CallCardContext) => {
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
        if (result.contacts[0]?.vars?.name) {
          phonebookName = result.contacts[0].vars.name;
        }
      }
    } catch {
      // Lookup failure must not block card open
    }

    setTemplate(tpl);
    setCallContext(call);
    setInitialValues(buildAutoPopulateValues(tpl, call, phonebookName));
    setIsVip(vip);
    setOpen(true);
  }, [triggerLookup]);

  useEffect(() => {
    if (!myAgent) {
      setOpen(false);
      setTemplate(null);
      setCallContext(null);
      openedForRef.current = null;
      return;
    }

    if (!activeCall) {
      if (myAgent.status !== 'WRAPUP') {
        if (!manualOpen) {
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
    setOpen(false);
    setManualOpen(false);
    openedForRef.current = null;
  }, []);

  return {
    open,
    template,
    initialValues,
    callContext,
    isVip,
    openManually,
    close,
    activeCall,
    agentStatus: myAgent?.status,
  };
}
