import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Label, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetSellerInfoQuery,
  useUpdateSellerInfoMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import type { ISellerInfo } from '@/entities/tenant';
import cls from './SellerSettingsForm.module.scss';

const EMPTY: ISellerInfo = {
  name: '', inn: '', kpp: '', ogrn: '', address: '',
  bankName: '', bankBik: '', bankAccount: '', corrAccount: '',
  serviceDescription: '', serviceCode: '',
};

export const SellerSettingsForm = memo(() => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetSellerInfoQuery();
  const [update, { isLoading: isSaving }] = useUpdateSellerInfoMutation();

  const [form, setForm] = useState<ISellerInfo>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = (field: keyof ISellerInfo) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await update(form).unwrap();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (isLoading) {
    return (
      <HStack justify="center" align="center" className="h-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </HStack>
    );
  }

  return (
    <VStack gap="20" className={cls.wrapper}>
      <Card>
        <CardHeader>
          <HStack gap="12" align="center">
            <div className={cls.icon}>
              <Building2 className="w-5 h-5" />
            </div>
            <VStack gap="2">
              <Text variant="h4">
                {t('cloudAdmin.settings.seller.title', 'Реквизиты поставщика')}
              </Text>
              <Text variant="muted">
                {t('cloudAdmin.settings.seller.subtitle', 'Используются при формировании актов и счетов для клиентов')}
              </Text>
            </VStack>
          </HStack>
        </CardHeader>

        <CardContent>
          <VStack gap="20">

            {/* ── Организация ─────────────────────────── */}
            <VStack gap="12">
              <Text className={cls.fieldFull} variant="muted">
                {t('cloudAdmin.settings.seller.sectionOrg', 'ОРГАНИЗАЦИЯ').toUpperCase()}
              </Text>
              <div className={cls.grid}>
                <div className={cls.fieldFull}>
                  <VStack gap="6">
                    <Label htmlFor="seller-name">
                      {t('cloudAdmin.settings.seller.name', 'Наименование организации')}
                    </Label>
                    <Input id="seller-name" value={form.name} onChange={set('name')}
                      placeholder="ООО КрАстериск Клауд" />
                  </VStack>
                </div>

                <div className={cls.field}>
                  <VStack gap="6">
                    <Label htmlFor="seller-inn">{t('cloudAdmin.settings.seller.inn', 'ИНН')}</Label>
                    <Input id="seller-inn" value={form.inn} onChange={set('inn')} placeholder="7712345678" />
                  </VStack>
                </div>

                <div className={cls.field}>
                  <VStack gap="6">
                    <Label htmlFor="seller-kpp">{t('cloudAdmin.settings.seller.kpp', 'КПП')}</Label>
                    <Input id="seller-kpp" value={form.kpp} onChange={set('kpp')} placeholder="771201001" />
                  </VStack>
                </div>

                <div className={cls.field}>
                  <VStack gap="6">
                    <Label htmlFor="seller-ogrn">{t('cloudAdmin.settings.seller.ogrn', 'ОГРН')}</Label>
                    <Input id="seller-ogrn" value={form.ogrn} onChange={set('ogrn')} placeholder="1027700132195" />
                  </VStack>
                </div>

                <div className={cls.fieldFull}>
                  <VStack gap="6">
                    <Label htmlFor="seller-address">
                      {t('cloudAdmin.settings.seller.address', 'Юридический адрес')}
                    </Label>
                    <Input id="seller-address" value={form.address} onChange={set('address')}
                      placeholder="123456, г. Москва, ул. Примерная, д. 1" />
                  </VStack>
                </div>
              </div>
            </VStack>

            {/* ── Банковские реквизиты ─────────────────── */}
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
                    <Input id="seller-bank-name" value={form.bankName} onChange={set('bankName')}
                      placeholder="АО «Альфа-Банк»" />
                  </VStack>
                </div>

                <div className={cls.field}>
                  <VStack gap="6">
                    <Label htmlFor="seller-bik">{t('cloudAdmin.settings.seller.bankBik', 'БИК')}</Label>
                    <Input id="seller-bik" value={form.bankBik} onChange={set('bankBik')} placeholder="044525593" />
                  </VStack>
                </div>

                <div className={cls.field}>
                  <VStack gap="6">
                    <Label htmlFor="seller-corr">
                      {t('cloudAdmin.settings.seller.corrAccount', 'Корр. счёт')}
                    </Label>
                    <Input id="seller-corr" value={form.corrAccount} onChange={set('corrAccount')}
                      placeholder="30101810200000000593" />
                  </VStack>
                </div>

                <div className={cls.fieldFull}>
                  <VStack gap="6">
                    <Label htmlFor="seller-account">
                      {t('cloudAdmin.settings.seller.bankAccount', 'Расчётный счёт')}
                    </Label>
                    <Input id="seller-account" value={form.bankAccount} onChange={set('bankAccount')}
                      placeholder="40702810123450101230" />
                  </VStack>
                </div>
              </div>
            </VStack>

            {/* ── Услуга (для актов) ────────────────────── */}
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
                    <Input id="seller-service-desc" value={form.serviceDescription}
                      onChange={set('serviceDescription')}
                      placeholder="Услуги облачной IP-телефонии" />
                  </VStack>
                </div>

                <div className={cls.field}>
                  <VStack gap="6">
                    <Label htmlFor="seller-service-code">
                      {t('cloudAdmin.settings.seller.serviceCode', 'Код предмета расчёта')}
                    </Label>
                    <Input id="seller-service-code" value={form.serviceCode}
                      onChange={set('serviceCode')} placeholder="26" />
                  </VStack>
                </div>
              </div>
            </VStack>

            {/* ── Footer ──────────────────────────────── */}
            <HStack justify="between" align="center">
              {saved && (
                <HStack gap="6" align="center" className={cls.savedMsg}>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <Text variant="muted">
                    {t('common.saved', 'Сохранено')}
                  </Text>
                </HStack>
              )}
              {!saved && <span />}

              <Button
                id="seller-settings-save"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving', 'Сохранение...')}</>
                  : t('common.save', 'Сохранить реквизиты')
                }
              </Button>
            </HStack>

          </VStack>
        </CardContent>
      </Card>
    </VStack>
  );
});

SellerSettingsForm.displayName = 'SellerSettingsForm';
