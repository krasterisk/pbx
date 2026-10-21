import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Flex,
  Text,
} from '@/shared/ui';
import styles from './FormSaveBar.module.scss';

export interface FormSaveBarProps {
  /** `true` when the form differs from the saved state. */
  dirty: boolean;
  saving?: boolean;
  /** Blocks Save (e.g. validation error). */
  saveDisabled?: boolean;
  onSave: () => void | Promise<void>;
  /** Reverts the form to the saved state. */
  onCancel: () => void;
  testId?: string;
  /** `sticky` floats over the page. `footer` stays under a scrolling form and does not cover fields. */
  placement?: 'sticky' | 'footer';
}

/**
 * One saving model for every settings form (U5.4): a sticky "Save / Cancel" bar that appears only
 * when something changed, plus a confirmation when the user navigates away with unsaved changes
 * (router navigation and tab close).
 */
export function FormSaveBar({
  dirty,
  saving = false,
  saveDisabled = false,
  onSave,
  onCancel,
  testId = 'cc-form-save-bar',
  placement = 'sticky',
}: FormSaveBarProps) {
  const { t } = useTranslation();
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <>
      {dirty && (
        <Flex
          align="center"
          justify="between"
          gap="12"
          wrap="wrap"
          role="status"
          className={placement === 'footer' ? styles.footer : styles.bar}
          data-testid={testId}
        >
          <Text variant="small">{t('callcenter.settings.saveBar.unsaved', 'You have unsaved changes')}</Text>
          <Flex gap="8">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving} data-testid={`${testId}-cancel`}>
              {t('callcenter.settings.saveBar.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || saveDisabled}
              data-testid={`${testId}-save`}
            >
              {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
            </Button>
          </Flex>
        </Flex>
      )}

      <Dialog open={blocker.state === 'blocked'} onOpenChange={(v) => { if (!v && blocker.state === 'blocked') blocker.reset(); }}>
        <DialogContent size="default" data-testid={`${testId}-leave-dialog`}>
          <DialogHeader>
            <DialogTitle>{t('callcenter.settings.saveBar.leaveTitle', 'Leave without saving?')}</DialogTitle>
          </DialogHeader>
          <Text>
            {t('callcenter.settings.saveBar.leaveBody', 'Changes you made on this page will be lost.')}
          </Text>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => blocker.state === 'blocked' && blocker.reset()}
              data-testid={`${testId}-stay`}
            >
              {t('callcenter.settings.saveBar.stay', 'Stay')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => blocker.state === 'blocked' && blocker.proceed()}
              data-testid={`${testId}-leave`}
            >
              {t('callcenter.settings.saveBar.leave', 'Leave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
