import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export interface BaselineForm<T> {
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  /** `true` when the form differs from the last saved/loaded state. */
  dirty: boolean;
  /** Applies server data. Skipped while the user has unsaved edits so a background refetch never wipes them. */
  syncFromServer: (next: T) => void;
  /** Marks the current form as saved. */
  markSaved: () => void;
  /** Reverts the form to the saved state. */
  revert: () => void;
}

/**
 * Form state with a saved baseline (U5.4): drives the "unsaved changes" bar and the leave guard.
 * Comparison is structural (`JSON.stringify`), so objects must keep a stable key order.
 */
export function useBaselineForm<T>(initial: T): BaselineForm<T> {
  const [form, setForm] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const syncFromServer = useCallback((next: T) => {
    if (dirtyRef.current) return;
    setForm(next);
    setBaseline(next);
  }, []);

  const markSaved = useCallback(() => setBaseline(form), [form]);
  const revert = useCallback(() => setForm(baseline), [baseline]);

  return { form, setForm, dirty, syncFromServer, markSaved, revert };
}
