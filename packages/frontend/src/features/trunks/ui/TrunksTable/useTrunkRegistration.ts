import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useBulkRegisterTrunksMutation, useRegisterTrunkMutation, type ITrunkListItem, type ITrunkRegistrationResult } from '@/shared/api/endpoints/trunkApi';

const BATCH_SIZE = 100;

export function useTrunkRegistration() {
  const { t } = useTranslation();
  const [registerTrunk] = useRegisterTrunkMutation();
  const [bulkRegister] = useBulkRegisterTrunksMutation();
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const setPending = useCallback((ids: string[], pending: boolean) => {
    ids.forEach((id) => pending ? pendingRef.current.add(id) : pendingRef.current.delete(id));
    setPendingIds(new Set(pendingRef.current));
  }, []);

  const requestRegistration = useCallback(async (trunk: ITrunkListItem) => {
    if (trunk.trunkType !== 'auth' || pendingRef.current.has(trunk.id)) return;
    setPending([trunk.id], true);
    try {
      await registerTrunk(trunk.id).unwrap();
      toast.success(t('trunks.registrationRequested'));
    } catch {
      toast.error(t('trunks.registrationFailed'));
    } finally {
      setPending([trunk.id], false);
    }
  }, [registerTrunk, setPending, t]);

  const requestSelectedRegistration = useCallback(async (selected: ITrunkListItem[]) => {
    const targets = Array.from(new Map(selected.map((trunk) => [trunk.id, trunk])).values());
    const eligible = targets.filter((trunk) => trunk.trunkType === 'auth');
    if (!eligible.length || eligible.some((trunk) => pendingRef.current.has(trunk.id))) return;
    const eligibleIds = eligible.map((trunk) => trunk.id);
    setPending(eligibleIds, true);
    const results: ITrunkRegistrationResult[] = [];
    try {
      for (let start = 0; start < targets.length; start += BATCH_SIZE) {
        const chunk = targets.slice(start, start + BATCH_SIZE);
        try {
          const response = await bulkRegister(chunk.map((trunk) => trunk.id)).unwrap();
          chunk.forEach((trunk) => {
            results.push(response.results.find((result) => result.id === trunk.id) ?? { id: trunk.id, status: trunk.trunkType === 'ip' ? 'skipped' : 'failed' });
          });
        } catch {
          results.push(...chunk.map((trunk): ITrunkRegistrationResult => ({ id: trunk.id, status: trunk.trunkType === 'ip' ? 'skipped' : 'failed' })));
        }
      }
      const requested = results.filter((result) => result.status === 'requested').length;
      const failed = results.filter((result) => result.status === 'failed').length;
      const skipped = results.filter((result) => result.status === 'skipped').length;
      if (requested) toast.success(t('trunks.registrationRequestedCount', { count: requested }));
      if (failed) toast.error(t('trunks.registrationFailedCount', { count: failed }));
      if (skipped) toast.info(t('trunks.registrationSkippedCount', { count: skipped }));
    } finally {
      setPending(eligibleIds, false);
    }
  }, [bulkRegister, setPending, t]);

  return { pendingIds, requestRegistration, requestSelectedRegistration };
}
