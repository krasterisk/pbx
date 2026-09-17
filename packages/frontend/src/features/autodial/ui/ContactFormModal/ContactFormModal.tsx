import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { IAutodialBaseField } from '@krasterisk/shared';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateAutodialContactMutation,
  useGetAutodialBaseQuery,
  useGetAutodialContactsQuery,
  useUpdateAutodialContactMutation,
} from '@/shared/api/endpoints/autodialApi';
import {
  autodialPageActions,
  selectAutodialContactModalOpen,
  selectAutodialSelectedContactUid,
} from '../../model/slice/autodialPageSlice';
import cls from './ContactFormModal.module.scss';

interface PhoneDraft {
  raw: string;
  is_primary: boolean;
  tz_offset_min: number;
}

type ValueMap = Record<string, string | number | boolean>;

interface ContactFormModalProps {
  baseUid: number;
}

export const ContactFormModal = memo(({ baseUid }: ContactFormModalProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectAutodialContactModalOpen);
  const contactUid = useAppSelector(selectAutodialSelectedContactUid);

  const { data: base } = useGetAutodialBaseQuery(baseUid, { skip: !isOpen });
  // Editing reuses the already-cached page rather than a per-contact request.
  const { data: contactsPage } = useGetAutodialContactsQuery(
    { baseUid },
    { skip: !isOpen || contactUid === null },
  );
  const [createContact, { isLoading: isCreating }] = useCreateAutodialContactMutation();
  const [updateContact, { isLoading: isUpdating }] = useUpdateAutodialContactMutation();

  const [values, setValues] = useState<ValueMap>({});
  const [phones, setPhones] = useState<PhoneDraft[]>([{ raw: '', is_primary: true, tz_offset_min: 0 }]);
  const [externalId, setExternalId] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const existing = contactsPage?.rows.find((row) => row.uid === contactUid);
    if (contactUid !== null && existing) {
      setValues(existing.values ?? {});
      setPhones(
        (existing.phones ?? []).map((p) => ({
          raw: p.raw || p.normalized,
          is_primary: p.is_primary,
          tz_offset_min: p.tz_offset_min,
        })),
      );
      setExternalId(existing.external_id ?? '');
      setComment(existing.comment ?? '');
    } else {
      setValues({});
      setPhones([{ raw: '', is_primary: true, tz_offset_min: 0 }]);
      setExternalId('');
      setComment('');
    }
  }, [isOpen, contactUid, contactsPage]);

  const fields = (base?.fields ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((field) => !field.is_phone);

  const close = () => dispatch(autodialPageActions.closeContactModal());

  const setPhone = (index: number, next: PhoneDraft) =>
    setPhones(phones.map((p, i) => (i === index ? next : p)));

  const markPrimary = (index: number) =>
    setPhones(phones.map((p, i) => ({ ...p, is_primary: i === index })));

  const onSave = async () => {
    const cleanPhones = phones
      .filter((p) => p.raw.trim())
      .map((p) => ({ ...p, raw: p.raw.trim() }));
    if (cleanPhones.length === 0) {
      setError(t('autodial.contacts.phoneRequired'));
      return;
    }
    if (!cleanPhones.some((p) => p.is_primary)) cleanPhones[0].is_primary = true;

    const missing = (base?.fields ?? []).find(
      (field: IAutodialBaseField) =>
        field.required && !field.is_phone && !String(values[field.key] ?? '').trim(),
    );
    if (missing) {
      setError(t('autodial.contacts.fieldRequired', { field: missing.label || missing.key }));
      return;
    }

    const data = {
      values,
      phones: cleanPhones,
      external_id: externalId.trim() || undefined,
      comment: comment.trim() || undefined,
    };
    try {
      if (contactUid !== null) {
        await updateContact({ baseUid, contactUid, data: data as never }).unwrap();
      } else {
        await createContact({ baseUid, data: data as never }).unwrap();
      }
      close();
    } catch {
      setError(t('autodial.contacts.saveFailed'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent size="large" className={cls.dialog} data-testid="autodial-contact-form-modal">
        <DialogHeader className={cls.header}>
          <DialogTitle>
            {contactUid !== null
              ? t('autodial.contacts.editTitle')
              : t('autodial.contacts.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <VStack
          gap="16"
          max
          className={cls.body}
          data-testid="autodial-contact-form-body"
          data-viewport="360,768,1440"
          data-overflow="y"
        >
          <VStack gap="8" max>
            <Text className={cls.sectionTitle}>{t('autodial.contacts.phones')}</Text>
            {phones.map((phone, index) => (
              <HStack key={index} gap="8" align="end" max wrap="wrap" className={cls.phoneRow}>
                <VStack gap="4" className={cls.grow}>
                  <Label htmlFor={`autodial-contact-phone-${index}`}>
                    {t('autodial.contacts.phone')}
                  </Label>
                  <Input
                    id={`autodial-contact-phone-${index}`}
                    value={phone.raw}
                    placeholder="+7 495 000-00-00"
                    onChange={(e) => setPhone(index, { ...phone, raw: e.target.value })}
                  />
                </VStack>
                <VStack gap="4" className={cls.narrow}>
                  <Label htmlFor={`autodial-contact-tz-${index}`}>
                    {t('autodial.contacts.tzOffset')}
                  </Label>
                  <Input
                    id={`autodial-contact-tz-${index}`}
                    type="number"
                    step={60}
                    value={phone.tz_offset_min}
                    onChange={(e) =>
                      setPhone(index, { ...phone, tz_offset_min: Number(e.target.value) || 0 })
                    }
                  />
                </VStack>
                <HStack gap="4" align="center" className={cls.primaryFlag}>
                  <Checkbox
                    id={`autodial-contact-primary-${index}`}
                    checked={phone.is_primary}
                    onChange={() => markPrimary(index)}
                  />
                  <Label htmlFor={`autodial-contact-primary-${index}`}>
                    {t('autodial.contacts.primary')}
                  </Label>
                </HStack>
                <TableRowActions>
                  <TableRowAction
                    danger
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    disabled={phones.length === 1}
                    onClick={() => setPhones(phones.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </TableRowAction>
                </TableRowActions>
              </HStack>
            ))}
            <HStack gap="8">
              <Button
                variant="outline"
                onClick={() =>
                  setPhones([...phones, { raw: '', is_primary: false, tz_offset_min: 0 }])
                }
              >
                <Plus size={16} />
                {t('autodial.contacts.addPhone')}
              </Button>
            </HStack>
            <Text className={cls.hint}>{t('autodial.contacts.tzHint')}</Text>
          </VStack>

          <VStack gap="8" max>
            <Text className={cls.sectionTitle}>{t('autodial.contacts.fieldsSection')}</Text>
            <div className={cls.grid}>
              {fields.map((field) => (
                <VStack gap="4" key={field.uid}>
                  <Label htmlFor={`autodial-contact-field-${field.key}`}>
                    {field.label || field.key}
                    {field.required ? ' *' : ''}
                  </Label>
                  {field.type === 'enum' ? (
                    <Select
                      id={`autodial-contact-field-${field.key}`}
                      value={String(values[field.key] ?? '')}
                      onChange={(e) =>
                        setValues({ ...values, [field.key]: e.target.value })
                      }
                    >
                      <option value="">-</option>
                      {(field.enum_values ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === 'boolean' ? (
                    <HStack gap="4" align="center">
                      <Checkbox
                        id={`autodial-contact-field-${field.key}`}
                        checked={values[field.key] === true}
                        onChange={(e) =>
                          setValues({ ...values, [field.key]: e.target.checked })
                        }
                      />
                      <Label htmlFor={`autodial-contact-field-${field.key}`}>
                        {t('common.enabled')}
                      </Label>
                    </HStack>
                  ) : (
                    <Input
                      id={`autodial-contact-field-${field.key}`}
                      type={
                        field.type === 'number' || field.type === 'money'
                          ? 'number'
                          : field.type === 'date'
                            ? 'date'
                            : 'text'
                      }
                      value={String(values[field.key] ?? '')}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [field.key]:
                            field.type === 'number' || field.type === 'money'
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </VStack>
              ))}

              <VStack gap="4">
                <Label htmlFor="autodial-contact-external">
                  {t('autodial.contacts.externalId')}
                </Label>
                <Input
                  id="autodial-contact-external"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                />
              </VStack>

              <VStack gap="4">
                <Label htmlFor="autodial-contact-comment">{t('autodial.contacts.comment')}</Label>
                <Input
                  id="autodial-contact-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </VStack>
            </div>
          </VStack>
        </VStack>

        <DialogFooter className={cls.footer} data-testid="autodial-contact-form-footer">
          <VStack gap="8" max align="end">
            {error && <Text className={cls.error}>{error}</Text>}
            <HStack gap="8" justify="end" max wrap="wrap" className={cls.footerActions}>
              <Button variant="outline" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button disabled={isCreating || isUpdating} onClick={() => void onSave()}>
                {isCreating || isUpdating ? <Loader2 size={16} className={cls.spinner} /> : null}
                {t('common.save')}
              </Button>
            </HStack>
          </VStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ContactFormModal.displayName = 'ContactFormModal';
