import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { autodialApi } from '@/shared/api/endpoints/autodialApi';
import { autodialOperationId } from './operationId';

interface Pending<Draft, Payload> { id: string; draft: Draft; payload: Payload }

export function uncertainAutodialSave(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR' || status === 'PARSING_ERROR'
    || typeof status === 'number' && status >= 500;
}

/** A timeout is not proof of failure. Retain the command and exact input until reconciled. */
export function useCreateCommand<Draft, Payload>(scope: 'base' | 'campaign' | 'contact', session = 'create', baseUid?: number) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth?.user);
  const storageKey = user?.uniqueid ? `autodial:create:${user.vpbx_user_uid}:${user.uniqueid}:${scope}:${session}` : null;
  const load = useCallback((): Pending<Draft, Payload> | null => {
    if (!storageKey) return null;
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      return value && typeof value.id === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(value.id) && value.draft && value.payload ? value : null;
    } catch { return null; }
  }, [storageKey]);
  const [pending, setPending] = useState<Pending<Draft, Payload> | null>(load);
  const current = useRef(pending);
  const [busy, setBusy] = useState(false), [slow, setSlow] = useState(false);
  const save = (value: Pending<Draft, Payload> | null) => {
    current.current = value; setPending(value);
    if (storageKey) try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey);
    } catch { /* In-memory identity still protects the current form session. */ }
  };
  useEffect(() => { const value = load(); current.current = value; setPending(value); }, [load]);
  useEffect(() => {
    if (!busy) { setSlow(false); return; }
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [busy]);

  const run = async <Result extends { uid: number }>(draft: Draft, payload: Payload,
    send: (payload: Payload, id: string) => Promise<Result>): Promise<Result> => {
    const command = current.current ?? { id: autodialOperationId(), draft, payload };
    save(command); setBusy(true);
    try { const result = await send(command.payload, command.id); save(null); return result; }
    catch (error) { if (!uncertainAutodialSave(error)) save(null); throw error; }
    finally { setBusy(false); }
  };
  const check = async (): Promise<number | null> => {
    if (!current.current) return null;
    setBusy(true);
    try {
      const request = dispatch(autodialApi.endpoints.checkAutodialUiCommand.initiate(current.current.id));
      try {
        const result = await request.unwrap();
        if (result.status === 'completed' && result.operation === `create_${scope}`) {
          // The original mutation may have invalidated before the server committed.
          // Reconciliation must refresh subscribers after the commit is known.
          dispatch(autodialApi.util.invalidateTags(scope === 'contact'
            ? baseUid ? [{ type: 'AutodialContacts', id: baseUid }, { type: 'AutodialBases', id: baseUid }] : []
            : [{ type: scope === 'base' ? 'AutodialBases' : 'AutodialCampaigns', id: 'LIST' },
              { type: scope === 'base' ? 'AutodialBases' : 'AutodialCampaigns', id: result.resource_uid }]));
          save(null); return result.resource_uid;
        }
        return null;
      } finally { request.reset(); }
    } finally { setBusy(false); }
  };
  return { pending, busy, slow, run, check };
}
