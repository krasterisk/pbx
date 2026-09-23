import { memo, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Text,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useCreateSellerMutation,
  useUpdateSellerMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import type { IBillingSeller } from '@/entities/tenant';
import cls from '../SellerSettingsForm/SellerSettingsForm.module.scss';

const EMPTY = {
  name: '',
  inn: '',
  kpp: '',
  ogrn: '',
  address: '',
  bankName: '',
  bankBik: '',
  bankAccount: '',
  corrAccount: '',
  serviceDescription: '',
  serviceCode: '',
  isDefault: false,
};

interface SellerFormModalProps {
  open: boolean;
  seller: IBillingSeller | null;
  onClose: () => void;
}

export const SellerFormModal = memo(function SellerFormModal({ open, seller, onClose }: SellerFormModalProps) {
  const { t } = useTranslation();
  const [createSeller, { isLoading: creating }] = useCreateSellerMutation();
  const [updateSeller, { isLoading: updating }] = useUpdateSellerMutation();
  const [form, setForm] = useState(EMPTY);
  const saving = creating || updating;

  useEffect(() => {
    if (!open) return;
    if (seller) {
      setForm({
        name: seller.name,
        inn: seller.inn,
        kpp: seller.kpp,
        ogrn: seller.ogrn,
        address: seller.address,
        bankName: seller.bankName,
        bankBik: seller.bankBik,
        bankAccount: seller.bankAccount,
        corrAccount: seller.corrAccount,
        serviceDescription: seller.serviceDescription,
        serviceCode: seller.serviceCode,
        isDefault: seller.isDefault,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, seller]);

  const set = (field: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (seller) {
        await updateSeller({ id: seller.id, data: form }).unwrap();
      } else {
        await createSeller(form).unwrap();
      }
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="xl" data-testid="seller-form-modal">
        <DialogHeader>
          <DialogTitle>
            {seller
              ? t('cloudAdmin.sellers.editTitle', 'Редактировать поставщика')
              : t('cloudAdmin.sellers.createTitle', 'Новый поставщик')}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="20" className={cls.scrollBody}>
          <VStack gap="12">
            <Text variant="muted">
              {t('cloudAdmin.settings.seller.sectionOrg', 'ОРГАНИЗАЦИЯ').toUpperCase()}
            </Text>
            <div className={cls.grid}>
              <div className={cls.fieldFull}>
                <VStack gap="6">
                  <Label htmlFor="seller-name">
                    {t('cloudAdmin.settings.seller.name', 'Наименование организации')} *
                  </Label>
                  <Input id="seller-name" value={form.name} onChange={set('name')} />
                </VStack>
              </div>
              <div className={cls.field}>
                <VStack gap="6">
                  <Label htmlFor="seller-inn">{t('cloudAdmin.settings.seller.inn', 'ИНН')}</Label>
                  <Input id="seller-inn" value={form.inn} onChange={set('inn')} />
                </VStack>
              </div>
              <div className={cls.field}>
                <VStack gap="6">
                  <Label htmlFor="seller-kpp">{t('cloudAdmin.settings.seller.kpp', 'КПП')}</Label>
                  <Input id="seller-kpp" value={form.kpp} onChange={set('kpp')} />
                </VStack>
              </div>
              <div className={cls.field}>
                <VStack gap="6">
                  <Label htmlFor="seller-ogrn">{t('cloudAdmin.settings.seller.ogrn', 'ОГРН')}</Label>
                  <Input id="seller-ogrn" value={form.ogrn} onChange={set('ogrn')} />
                </VStack>
              </div>
              <div className={cls.fieldFull}>
                <VStack gap="6">
                  <Label htmlFor="seller-address">
                    {t('cloudAdmin.settings.seller.address', 'Юридический адрес')}
                  </Label>
                  <Input id="seller-address" value={form.address} onChange={set('address')} />
                </VStack>
              </div>
            </div>
          </VStack>

          <VStack gap="12">
            <Text variant="muted">
              {t('cloudAdmin.settings.seller.sectionBank', 'БАНКОВСКИЕ РЕКВИЗИТЫ').toUpperCase()}
            </Text>
            <div className={cls.grid}>
              <div className={cls.fieldFull}>
                <VStack gap="6">
                  <Label htmlFor="seller-bank-name">
                    {t('cloudAdmin.settings.seller.bankName', 'Наименование банка')}
                  </Label>
                  <Input id="seller-bank-name" value={form.bankName} onChange={set('bankName')} />
                </VStack>
              </div>
              <div className={cls.field}>
                <VStack gap="6">
                  <Label htmlFor="seller-bik">{t('cloudAdmin.settings.seller.bankBik', 'БИК')}</Label>
                  <Input id="seller-bik" value={form.bankBik} onChange={set('bankBik')} />
                </VStack>
              </div>
              <div className={cls.field}>
                <VStack gap="6">
                  <Label htmlFor="seller-corr">
                    {t('cloudAdmin.settings.seller.corrAccount', 'Корр. счёт')}
                  </Label>
                  <Input id="seller-corr" value={form.corrAccount} onChange={set('corrAccount')} />
                </VStack>
              </div>
              <div className={cls.fieldFull}>
                <VStack gap="6">
                  <Label htmlFor="seller-account">
                    {t('cloudAdmin.settings.seller.bankAccount', 'Расчётный счёт')}
                  </Label>
                  <Input id="seller-account" value={form.bankAccount} onChange={set('bankAccount')} />
                </VStack>
              </div>
            </div>
          </VStack>

          <VStack gap="12">
            <Text variant="muted">
              {t('cloudAdmin.settings.seller.sectionService', 'ОПИСАНИЕ УСЛУГИ В АКТАХ').toUpperCase()}
            </Text>
            <div className={cls.grid}>
              <div className={cls.fieldFull}>
                <VStack gap="6">
                  <Label htmlFor="seller-service-desc">
                    {t('cloudAdmin.settings.seller.serviceDescription', 'Наименование услуги')}
                  </Label>
                  <Input
                    id="seller-service-desc"
                    value={form.serviceDescription}
                    onChange={set('serviceDescription')}
                  />
                </VStack>
              </div>
              <div className={cls.field}>
                <VStack gap="6">
                  <Label htmlFor="seller-service-code">
                    {t('cloudAdmin.settings.seller.serviceCode', 'Код предмета расчёта')}
                  </Label>
                  <Input id="seller-service-code" value={form.serviceCode} onChange={set('serviceCode')} />
                </VStack>
              </div>
            </div>
          </VStack>

          {!seller?.isDefault && (
            <HStack gap="8" align="center">
              <input
                id="seller-is-default"
                type="checkbox"
                checked={form.isDefault}
                onChange={set('isDefault')}
              />
              <Label htmlFor="seller-is-default">
                {t('cloudAdmin.sellers.makeDefault', 'Сделать по умолчанию')}
              </Label>
            </HStack>
          )}
        </VStack>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !form.name.trim()}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
