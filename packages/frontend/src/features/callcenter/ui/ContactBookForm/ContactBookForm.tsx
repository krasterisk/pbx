import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Button,
  Input,
  Label,
  Text,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui';
import {
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  type ICcContact,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './ContactBookForm.module.scss';

interface ContactFormState {
  name: string;
  number: string;
  note: string;
}

const EMPTY_FORM: ContactFormState = {
  name: '',
  number: '',
  note: '',
};

/** D-13 UX gate - server still enforces ownership in the where clause. */
export function canManageContact(
  row: Pick<ICcContact, 'createdBy'>,
  myUserId: number,
  isSupervisor: boolean,
): boolean {
  return row.createdBy === myUserId || isSupervisor;
}

export interface ContactBookFormProps {
  /** When true, Sheet is open for create or edit. */
  open: boolean;
  /** Row being edited; null = create mode. */
  editing: ICcContact | null;
  /** Row pending destructive confirm; null = dialog closed. */
  deleteTarget: ICcContact | null;
  myUserId: number;
  onOpenChange: (open: boolean) => void;
  onDeleteTargetChange: (row: ICcContact | null) => void;
  /** Fired after successful create/update (for scroll-into-view in Contacts list). */
  onSaved?: (row: ICcContact) => void;
}

/**
 * Inline Sheet CRUD for the softphone shared contact book (D-11/D-12/D-13).
 * SoftphoneContacts owns per-row Pencil/Trash visibility; this form owns mutations
 * and the two locked delete-confirmation copy variants.
 */
export function ContactBookForm({
  open,
  editing,
  deleteTarget,
  myUserId,
  onOpenChange,
  onDeleteTargetChange,
  onSaved,
}: ContactBookFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [createContact, { isLoading: isCreating }] = useCreateContactMutation();
  const [updateContact, { isLoading: isUpdating }] = useUpdateContactMutation();
  const [deleteContact, { isLoading: isDeleting }] = useDeleteContactMutation();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        number: editing.number,
        note: editing.note || '',
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [open, editing]);

  const handleSave = async () => {
    const name = form.name.trim();
    const number = form.number.trim();
    if (!name || !number) {
      toast.error(t('common.error', 'Error'));
      return;
    }
    const note = form.note.trim();
    try {
      if (editing) {
        const updated = await updateContact({
          id: editing.uid,
          body: { name, number, note },
        }).unwrap();
        onOpenChange(false);
        toast.success(t('common.success', 'Success'));
        onSaved?.(updated);
      } else {
        const created = await createContact({ name, number, note: note || undefined }).unwrap();
        onOpenChange(false);
        toast.success(t('common.success', 'Success'));
        onSaved?.(created);
      }
    } catch {
      toast.error(t('common.error', 'Error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteContact(deleteTarget.uid).unwrap();
      onDeleteTargetChange(null);
      toast.success(t('common.success', 'Success'));
    } catch {
      toast.error(t('common.error', 'Error'));
    }
  };

  const deleteIsOwn = deleteTarget ? deleteTarget.createdBy === myUserId : true;
  const deleteCopy = deleteIsOwn
    ? t(
      'callcenter.contacts.deleteConfirmOwn',
      'Delete contact: the entry will be removed from the shared book. Continue?',
    )
    : t(
      'callcenter.contacts.deleteConfirmSupervisor',
      "Delete agent's contact: the entry will be removed from the shared book for everyone. Continue?",
    );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing
                ? t('common.edit', 'Edit')
                : t('callcenter.softphone.addContact', 'Add contact')}
            </SheetTitle>
          </SheetHeader>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <Label htmlFor="cc-contact-name">{t('users.name', 'Name')}</Label>
              <Input
                id="cc-contact-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                aria-label={t('users.name', 'Name')}
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="cc-contact-number">
                {t('callcenter.cards.fieldTypes.phone', 'Phone')}
              </Label>
              <Input
                id="cc-contact-number"
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                aria-label={t('callcenter.cards.fieldTypes.phone', 'Phone')}
              />
            </div>
            <div className={styles.field}>
              <Label htmlFor="cc-contact-note">
                {t('callcenter.contacts.noteLabel', 'Note')}
              </Label>
              <Input
                id="cc-contact-note"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                aria-label={t('callcenter.contacts.noteLabel', 'Note')}
                placeholder={t('callcenter.contacts.notePlaceholder', 'Optional note')}
              />
            </div>
          </div>
          <SheetFooter className={styles.footer}>
            <Button
              type="button"
              variant="outline"
              className={styles.touchBtn}
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              className={styles.touchBtn}
              disabled={isCreating || isUpdating}
              onClick={() => void handleSave()}
            >
              {t('common.save', 'Save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) onDeleteTargetChange(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.delete', 'Delete')}</DialogTitle>
          </DialogHeader>
          <div className={styles.deleteBody}>
            <Text>{deleteCopy}</Text>
          </div>
          <DialogFooter className={styles.footer}>
            <Button
              type="button"
              variant="outline"
              className={styles.touchBtn}
              onClick={() => onDeleteTargetChange(null)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={styles.touchBtn}
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
