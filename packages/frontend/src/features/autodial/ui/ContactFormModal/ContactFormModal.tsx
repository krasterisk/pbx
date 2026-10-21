import { useAutodialConfirmation } from '../AutodialConfirmation/useAutodialConfirmation';
import { useAutodialDialogFocus } from '../AutodialConfirmation/useAutodialDialogFocus';
import { Switch } from '@/shared/ui';
import { ModalBody } from '@/shared/ui';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { IAutodialBaseField, CreateAutodialContactInput } from '@krasterisk/shared';
import {
  Button,
  Checkbox,
  Dialog,
  FormDialogContent,
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
  useGetAutodialContactQuery,
  useUpdateAutodialContactMutation,
} from '@/shared/api/endpoints/autodialApi';
import {
  autodialPageActions,
  selectAutodialContactModalOpen,
  selectAutodialSelectedContactUid,
} from '../../model/slice/autodialPageSlice';
import cls from './ContactFormModal.module.scss';
import { autodialErrorKey } from '../../lib/mutationError';
import { PhoneOffsetSelect } from '../PhoneOffsetSelect/PhoneOffsetSelect';
import { useCreateCommand, uncertainAutodialSave } from '../../model/useCreateCommand';
import { CreateCommandStatus } from '../CreateCommandStatus/CreateCommandStatus';
import { ContactHistory } from './ContactHistory';

interface PhoneDraft {
  uid?: number;
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
  const { confirm, confirmationDialog } = useAutodialConfirmation();
  const dialogFocus = useAutodialDialogFocus();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectAutodialContactModalOpen);
  const contactUid = useAppSelector(selectAutodialSelectedContactUid);

  const { currentData: base, isError: baseError, refetch: refetchBase } = useGetAutodialBaseQuery(baseUid, { skip: !isOpen });
  const { currentData: existing, isError: contactError, refetch: refetchContact } = useGetAutodialContactQuery(
    { baseUid, contactUid: contactUid ?? 0 },
    { skip: !isOpen || contactUid === null },
  );
  const [createContact, { isLoading: isCreating }] = useCreateAutodialContactMutation();
  const [updateContact, { isLoading: isUpdating }] = useUpdateAutodialContactMutation();

  const [values, setValues] = useState<ValueMap>({});
  const [phones, setPhones] = useState<PhoneDraft[]>([{ raw: '', is_primary: true, tz_offset_min: 0 }]);
  const [externalId, setExternalId] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const baseline = useRef('');
  const sessionKey = `${baseUid}:${contactUid ?? 'new'}`;
  const command = useCreateCommand<CreateAutodialContactInput, CreateAutodialContactInput>('contact', sessionKey, baseUid);
  const isSaving = isCreating || isUpdating || command.busy;
  const loadError = baseError || (contactUid !== null && contactError);
  const isReady = Boolean(base) && hydratedKey === sessionKey && !loadError;

  useEffect(() => {
    if (!isOpen) { setHydratedKey(null); return; }
    if (hydratedKey === sessionKey || !base || (contactUid !== null && !existing)) return;
    setError(null);
    const pending = command.pending?.draft;
    const initial = contactUid !== null && existing ? {
      values: existing.values ?? {},
      phones: (existing.phones ?? []).map((p) => ({ uid: p.uid, raw: p.raw || p.normalized, is_primary: p.is_primary, tz_offset_min: p.tz_offset_min })),
      externalId: existing.external_id ?? '', comment: existing.comment ?? '',
    } : {
      values: pending?.values ?? Object.fromEntries(base.fields.filter((field) => field.type === 'boolean').map((field) => [field.key, false])),
      phones: pending?.phones.map((phone) => ({ ...phone, is_primary: phone.is_primary ?? false, tz_offset_min: phone.tz_offset_min ?? 0 })) ?? [{ raw: '', is_primary: true, tz_offset_min: 0 }],
      externalId: pending?.external_id ?? '', comment: pending?.comment ?? '',
    };
    setValues(initial.values); setPhones(initial.phones); setExternalId(initial.externalId); setComment(initial.comment);
    baseline.current = JSON.stringify(initial);
    setHydratedKey(sessionKey);
  }, [isOpen, contactUid, existing, base, sessionKey, hydratedKey, command.pending]);

  const fields = (base?.fields ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((field) => !field.is_phone && field.type !== 'phone');

  const close = async (force = false) => {
    if (!force) {
      const message = command.pending ? 'autodial.workspace.commandCloseHint'
        : isReady && JSON.stringify({ values, phones, externalId, comment }) !== baseline.current ? 'autodial.workspace.discard' : null;
      if (message && !(await confirm(t(message)))) return;
    }
    dispatch(autodialPageActions.closeContactModal());
  };

  const setPhone = (index: number, next: PhoneDraft) =>
    setPhones(phones.map((p, i) => (i === index ? next : p)));

  const markPrimary = (index: number) =>
    setPhones(phones.map((p, i) => ({ ...p, is_primary: i === index })));

  const onSave = async () => {
    if (!isReady || isSaving) return;
    const original = command.pending?.payload;
    const cleanPhones = (original?.phones ?? phones)
      .filter((p) => p.raw.trim())
      .map((p) => ({ ...p, raw: p.raw.trim() }));
    if (cleanPhones.length === 0) {
      setError(t('autodial.contacts.phoneRequired'));
      return;
    }
    if (!cleanPhones.some((p) => p.is_primary)) cleanPhones[0].is_primary = true;

    const missing = (base?.fields ?? []).find(
      (field: IAutodialBaseField) =>
        field.required && !field.is_phone && field.type !== 'phone' && !String(values[field.key] ?? '').trim(),
    );
    if (missing && !original) {
      setError(t('autodial.contacts.fieldRequired', { field: missing.label || missing.key }));
      return;
    }

    const data = original ?? {
      values,
      phones: cleanPhones,
      external_id: externalId.trim() || null,
      comment: comment.trim(),
    };
    try {
      if (contactUid !== null) {
        await updateContact({ baseUid, contactUid, data }).unwrap();
      } else {
        await command.run(data, data, (body, id) => createContact({ baseUid, data: body, ui_command_id: id }).unwrap());
      }
      close(true);
    } catch (error) {
      setError(uncertainAutodialSave(error) ? contactUid === null ? null : t('autodial.workspace.updateUncertain') : t(autodialErrorKey(error, 'autodial.contacts.saveFailed')));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && close()}>
      {confirmationDialog}
      <FormDialogContent {...dialogFocus} size="large" className={cls.dialog} data-testid="autodial-contact-form-modal" aria-describedby={undefined}>
        <DialogHeader className={cls.header}>
          <DialogTitle>
            {contactUid !== null
              ? t('autodial.contacts.editTitle')
              : t('autodial.contacts.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <ModalBody


          className={cls.body}
          data-testid="autodial-contact-form-body"
          data-viewport="360,768,1440"
          data-overflow="y"
        >
          {loadError ? (
            <QueryErrorState message={t('autodial.common.loadFailed')} onRetry={() => { void refetchBase(); if (contactUid !== null) void refetchContact(); }} retryLabel={t('autodial.common.retry')} />
          ) : !isReady ? <Loader2 aria-label={t('common.loading')} /> : null}
          <VStack align="stretch" gap="8" max inert={!isReady || isSaving || Boolean(command.pending)}>
            <Text className={cls.sectionTitle}>{t('autodial.contacts.phones')}</Text>
            {phones.map((phone, index) => (
              <HStack key={index} gap="8" align="end" max wrap="wrap" className={cls.phoneRow}>
                <VStack align="stretch" gap="4" className={cls.grow}>
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
                <VStack align="stretch" gap="4" className={cls.narrow}>
                  <Label htmlFor={`autodial-contact-tz-${index}`}>
                    {t('autodial.workspace.phoneTimezone')}
                  </Label>
                  <PhoneOffsetSelect
                    id={`autodial-contact-tz-${index}`}
                    value={phone.tz_offset_min}
                    onChange={(minutes) =>
                      setPhone(index, { ...phone, tz_offset_min: minutes })
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
            <Text className={cls.hint}>{t('autodial.workspace.phoneTimezoneHint')}</Text>
          </VStack>

          <VStack align="stretch" gap="8" max inert={!isReady || isSaving || Boolean(command.pending)}>
            <Text className={cls.sectionTitle}>{t('autodial.contacts.fieldsSection')}</Text>
            <div className={cls.grid}>
              {fields.map((field) => (
                <VStack align="stretch" gap="4" key={field.uid}>
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
                      <Switch
                        id={`autodial-contact-field-${field.key}`}
                        checked={values[field.key] === true}
                        onCheckedChange={(checked) => setValues({ ...values, [field.key]: checked })
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
                              ? (e.target.value === '' ? '' : Number(e.target.value))
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </VStack>
              ))}

              <VStack align="stretch" gap="4">
                <Label htmlFor="autodial-contact-external">
                  {t('autodial.contacts.externalId')}
                </Label>
                <Input
                  id="autodial-contact-external"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                />
              </VStack>

              <VStack align="stretch" gap="4">
                <Label htmlFor="autodial-contact-comment">{t('autodial.contacts.comment')}</Label>
                <Input
                  id="autodial-contact-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </VStack>
            </div>
          </VStack>
          {isReady && contactUid !== null && <ContactHistory baseUid={baseUid} contactUid={contactUid} />}
        </ModalBody>

        <DialogFooter className={cls.footer} data-testid="autodial-contact-form-footer">
          <VStack gap="8" max align="end">
            <CreateCommandStatus pending={Boolean(command.pending)} busy={command.busy} slow={command.slow} onCheck={() => {
              void command.check().then((saved) => { if (saved) close(true); else setError(t('autodial.workspace.commandStillUnknown')); }).catch(() => setError(t('autodial.workspace.commandCheckFailed')));
            }} />
            {error && <Text className={cls.error} role="alert">{error}</Text>}
            <HStack gap="8" justify="end" max wrap="wrap" className={cls.footerActions}>
              <Button variant="outline" disabled={isSaving} onClick={() => close()}>
                {t('common.cancel')}
              </Button>
              <Button disabled={isSaving || !isReady} onClick={() => void onSave()}>
                {isCreating || isUpdating ? <Loader2 size={16} className={cls.spinner} /> : null}
                {t('common.save')}
              </Button>
            </HStack>
          </VStack>
        </DialogFooter>
      </FormDialogContent>
    </Dialog>
  );
});

ContactFormModal.displayName = 'ContactFormModal';
