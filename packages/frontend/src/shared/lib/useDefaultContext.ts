import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { IContext } from '@/shared/api/endpoints/contextApi';

/** Apply late-loaded defaults only to an untouched new draft, never edit/copy. */
export function useDefaultContext(isOpen: boolean, isCreate: boolean, contexts: IContext[], kind: 'endpoints' | 'trunks', setContext: Dispatch<SetStateAction<string>>) {
  const touched = useRef(false);
  useEffect(() => { if (isOpen) touched.current = false; }, [isOpen, isCreate]);
  useEffect(() => {
    if (isOpen && isCreate && !touched.current) {
      setContext(contexts.find((context) => context[`is_default_for_${kind}`])?.name ?? '');
    }
  }, [isOpen, isCreate, contexts, kind, setContext]);
  return useCallback((value: string) => { touched.current = true; setContext(value); }, [setContext]);
}
