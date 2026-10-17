import { useTranslation } from 'react-i18next';
import {
  Dialog,
  FormDialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  ModalBody,
  Button,
} from '@/shared/ui';
import {
  ShiftLoginForm,
  type ShiftLoginResult,
  type SoftphoneMode,
} from './ShiftLoginForm';

export type { ShiftLoginResult, SoftphoneMode };

interface ShiftLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: ShiftLoginResult) => void | Promise<void>;
  /**
   * Supervisor starts a shift for another agent: same SIP/WebRTC choice,
   * but no local headset/mic setup (media runs on the operator's side).
   */
  remoteAgent?: boolean;
  title?: string;
  subtitle?: string;
  /** null = all queues; otherwise filter to access-list queues. */
  allowedQueues?: string[] | null;
}

/** Dialog wrapper around {@link ShiftLoginForm} (supervisor "start shift for operator"). */
export function ShiftLoginModal({
  open,
  onOpenChange,
  onConfirm,
  remoteAgent = false,
  title,
  subtitle,
  allowedQueues = null,
}: ShiftLoginModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent size="xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title || t('callcenter.softphone.startShift')}</DialogTitle>
        </DialogHeader>

        <ModalBody>
        <ShiftLoginForm
          active={open}
          onConfirm={onConfirm}
          onDone={() => onOpenChange(false)}
          remoteAgent={remoteAgent}
          subtitle={subtitle}
          allowedQueues={allowedQueues}
          renderFooter={({ submit, canSubmit, submitting }) => (
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t('callcenter.transfer.cancel', 'Cancel')}
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {t('callcenter.softphone.startShift')}
              </Button>
            </DialogFooter>
          )}
        />
        </ModalBody>
      </FormDialogContent>
    </Dialog>
  );
}
