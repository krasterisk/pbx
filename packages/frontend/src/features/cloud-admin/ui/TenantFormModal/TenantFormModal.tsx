import { Switch } from '@/shared/ui';
import { ModalBody } from '@/shared/ui';
import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, FormDialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Label, Text, Select, PasswordInput } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useGetSellersQuery,
} from '@/shared/api/endpoints/cloudAdminApi';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import cls from './TenantFormModal.module.scss';

type Tab = 'general' | 'limits';

export const TenantFormModal = memo(() => {
  const { t, i18n } = useTranslation();
  const dashboardLabel = (key: string, ru: string, en: string) => t(key, {
    defaultValue: (i18n?.resolvedLanguage ?? i18n?.language ?? 'ru').startsWith('en') ? en : ru,
  });
  const dispatch = useAppDispatch();
  const { isModalOpen, modalMode, selectedTenant } = useAppSelector((s) => s.tenantsPage);
  const { data: sellers = [] } = useGetSellersQuery(undefined, { skip: !isModalOpen });

  const [activeTab, setActiveTab] = useState<Tab>('general');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inn, setInn] = useState('');
  const [password, setPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [maxExt, setMaxExt] = useState('10');
  const [maxTrunks, setMaxTrunks] = useState('2');
  const [maxQueues, setMaxQueues] = useState('3');
  const [sellerId, setSellerId] = useState<number | ''>('');
  const [ownModels, setOwnModels] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planExpiry, setPlanExpiry] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [saveError, setSaveError] = useState('');

  const [createTenant, { isLoading: isCreating }] = useCreateTenantMutation();
  const [updateTenant, { isLoading: isUpdating }] = useUpdateTenantMutation();
  const isLoading = isCreating || isUpdating;

  useEffect(() => {
    if (!isModalOpen) return;
    if (modalMode === 'edit' && selectedTenant) {
      setName(selectedTenant.name);
      setSlug(selectedTenant.slug ?? '');
      setEmail(selectedTenant.email ?? '');
      setPhone(selectedTenant.phone ?? '');
      setInn(selectedTenant.company_inn ?? '');
      setMaxExt(String(selectedTenant.max_extensions));
      setMaxTrunks(String(selectedTenant.max_trunks));
      setMaxQueues(String(selectedTenant.max_queues));
      setSellerId(selectedTenant.seller_id || '');
      setOwnModels(selectedTenant.sa_own_models === true);
      setPlanName(selectedTenant.plan_name ?? '');
      setPlanExpiry(selectedTenant.plan_expires_at?.slice(0, 16) ?? '');
      setMaxConcurrent(selectedTenant.max_concurrent_calls == null ? '' : String(selectedTenant.max_concurrent_calls));
      setTimezone(selectedTenant.timezone ?? 'UTC');
      setPassword('');
    } else {
      setName('');
      setSlug('');
      setEmail('');
      setPhone('');
      setInn('');
      setPassword('');
      setAdminName('');
      setTrialDays('14');
      setMaxExt('10');
      setMaxTrunks('2');
      setMaxQueues('3');
      setSellerId('');
      setOwnModels(false);
      setPlanName('');
      setPlanExpiry('');
      setMaxConcurrent('');
      setTimezone('UTC');
    }
    setSaveError('');
    setActiveTab('general');
  }, [modalMode, selectedTenant, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || sellerId) return;
    const fallback = sellers.find((seller) => seller.isDefault) ?? sellers[0];
    if (fallback) setSellerId(fallback.id);
  }, [isModalOpen, sellerId, sellers]);

  const handleClose = () => dispatch(tenantsPageActions.closeModal());

  const resolvedSellerId = sellerId
    || sellers.find((seller) => seller.isDefault)?.id
    || sellers[0]?.id
    || '';
  let timezoneValid = false;
  try { new Intl.DateTimeFormat('en', { timeZone: timezone.trim() }).format(); timezoneValid = Boolean(timezone.trim()); }
  catch { /* Invalid organization zone prevents a misleading dashboard period. */ }
  const concurrencyValid = maxConcurrent === '' || /^\d+$/.test(maxConcurrent) && Number(maxConcurrent) <= 1_000_000;
  const dashboardValid = timezoneValid && concurrencyValid && planName.trim().length <= 128;
  const isValid = dashboardValid && (modalMode === 'edit'
    ? Boolean(name.trim())
    : Boolean(name.trim() && email.trim() && resolvedSellerId && password.trim()));

  const handleSubmit = async () => {
    if (!isValid) return;
    const seller = resolvedSellerId || selectedTenant?.seller_id || undefined;
    setSaveError('');
    const dashboardSettings = {
      plan_name: planName.trim() || null,
      plan_expires_at: planExpiry
        ? planExpiry === selectedTenant?.plan_expires_at?.slice(0, 16)
          ? selectedTenant.plan_expires_at
          : new Date(`${planExpiry}Z`).toISOString()
        : null,
      max_concurrent_calls: maxConcurrent === '' ? null : Number(maxConcurrent),
      timezone: timezone.trim(),
    };
    try {
      if (modalMode === 'create') {
        await createTenant({
          name: name.trim(),
          slug: slug.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          company_inn: inn.trim() || undefined,
          password: password.trim(),
          admin_name: adminName.trim() || undefined,
          trial_days: parseInt(trialDays, 10) || 14,
          max_extensions: parseInt(maxExt, 10) || 10,
          max_trunks: parseInt(maxTrunks, 10) || 2,
          max_queues: parseInt(maxQueues, 10) || 3,
          seller_id: seller,
          ...dashboardSettings,
        }).unwrap();
      } else if (selectedTenant) {
        await updateTenant({
          id: selectedTenant.id,
          data: {
            name: name.trim(),
            slug: slug.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            company_inn: inn.trim() || undefined,
            max_extensions: parseInt(maxExt, 10) || 10,
            max_trunks: parseInt(maxTrunks, 10) || 2,
            max_queues: parseInt(maxQueues, 10) || 3,
            seller_id: seller,
            sa_own_models: ownModels,
            ...dashboardSettings,
          },
        }).unwrap();
      }
      handleClose();
    } catch (err) {
      console.error('Tenant form error:', err);
      setSaveError(dashboardLabel('cloudAdmin.tenants.dashboard.saveError', 'Не удалось сохранить кабинет. Проверьте поля и повторите попытку.', 'Could not save the cabinet. Check the fields and try again.'));
    }
  };

  const title = modalMode === 'create'
    ? t('cloudAdmin.tenants.createTitle', 'Новый кабинет')
    : t('cloudAdmin.tenants.editTitle', 'Редактировать кабинет');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: t('cloudAdmin.tenants.tabGeneral', 'Основные') },
    { key: 'limits', label: t('cloudAdmin.tenants.tabLimits', 'Лимиты') },
  ];

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <FormDialogContent size="large" className={cls.dialog} data-testid="tenant-form-modal" aria-describedby={undefined}>
        <DialogHeader className={cls.header}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Flex direction="column" className={cls.tabsWrap} max>
          <Flex className={cls.tabsRow} role="tablist" max>
            {TABS.map((tab) => (
              <Button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={[cls.tab, activeTab === tab.key && cls.tabActive].filter(Boolean).join(' ')}
                onClick={() => setActiveTab(tab.key)}
              >
                <Text as="span">{tab.label}</Text>
              </Button>
            ))}
          </Flex>
        </Flex>

        <ModalBody className={cls.scrollBody}  >
          {activeTab === 'general' && (
            <VStack align="stretch" gap="16" max>
              <Flex className={cls.formGrid} max>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-name">
                    {t('cloudAdmin.tenants.field.name', 'Название организации')} *
                  </Label>
                  <Input
                    id="tenant-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('cloudAdmin.tenants.placeholder.name', 'ООО Ромашка')}
                  />
                </VStack>

                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-slug">
                    {t('cloudAdmin.tenants.field.slug', 'Идентификатор (slug)')}
                  </Label>
                  <Input
                    id="tenant-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="romashka"
                  />
                </VStack>

                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-email">
                    {t('cloudAdmin.tenants.field.email', 'Email (логин администратора)')} *
                  </Label>
                  <Input
                    id="tenant-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@romashka.ru"
                    disabled={modalMode === 'edit'}
                  />
                </VStack>

                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-phone">
                    {t('cloudAdmin.tenants.field.phone', 'Телефон')}
                  </Label>
                  <Input
                    id="tenant-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (xxx) xxx-xx-xx"
                  />
                </VStack>

                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-inn">
                    {t('cloudAdmin.tenants.field.inn', 'ИНН')}
                  </Label>
                  <Input
                    id="tenant-inn"
                    value={inn}
                    onChange={(e) => setInn(e.target.value)}
                    placeholder="7712345678"
                  />
                </VStack>

                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-seller">
                    {t('cloudAdmin.tenants.field.seller', 'Поставщик')} *
                  </Label>
                  <Select
                    id="tenant-seller"
                    data-testid="tenant-seller-select"
                    value={sellerId === '' ? '' : String(sellerId)}
                    onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : '')}
                    error={!sellerId}
                  >
                    <option value="" disabled>
                      {t('cloudAdmin.tenants.placeholder.seller', 'Выберите поставщика')}
                    </option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.isDefault ? ` (${t('cloudAdmin.sellers.defaultBadge', 'по умолчанию')})` : ''}
                      </option>
                    ))}
                  </Select>
                </VStack>
              </Flex>

              {modalMode === 'edit' && (
                <HStack gap="8" align="center">
                  <Switch
                    id="tenant-own-models"
                    checked={ownModels}
                    onCheckedChange={(checked) => setOwnModels(checked)}
                  />
                  <Label htmlFor="tenant-own-models">
                    {t('cloudAdmin.tenants.ownModels', 'Использует свои модели')}
                  </Label>
                </HStack>
              )}

              {modalMode === 'create' && (
                <VStack align="stretch" gap="12" max className={cls.section}>
                  <Text className={cls.sectionTitle}>
                    {t('cloudAdmin.tenants.sectionAdmin', 'Администратор кабинета')}
                  </Text>
                  <Flex className={cls.formGrid} max>
                    <VStack align="stretch" gap="8" max className={cls.field}>
                      <Label htmlFor="tenant-admin-name">
                        {t('cloudAdmin.tenants.field.adminName', 'Имя администратора')}
                      </Label>
                      <Input
                        id="tenant-admin-name"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder={t('cloudAdmin.tenants.placeholder.adminName', 'Иванов Иван')}
                      />
                    </VStack>
                    <VStack align="stretch" gap="8" max className={cls.field}>
                      <Label htmlFor="tenant-password">
                        {t('cloudAdmin.tenants.field.password', 'Пароль')} *
                      </Label>
                      <PasswordInput
                        id="tenant-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <Text className={cls.hint}>
                        {t('cloudAdmin.tenants.passwordHint', 'Пароль для входа администратора в кабинет')}
                      </Text>
                    </VStack>
                    <VStack align="stretch" gap="8" max className={cls.field}>
                      <Label htmlFor="tenant-trial-days">
                        {t('cloudAdmin.tenants.field.trialDays', 'Пробный период (дней)')}
                      </Label>
                      <Input
                        id="tenant-trial-days"
                        type="number"
                        min="0"
                        value={trialDays}
                        onChange={(e) => setTrialDays(e.target.value)}
                      />
                    </VStack>
                  </Flex>
                </VStack>
              )}
            </VStack>
          )}

          {activeTab === 'limits' && (
            <VStack align="stretch" gap="16" max>
              <Text>{dashboardLabel('cloudAdmin.tenants.dashboard.title', 'Тариф АТС и время организации', 'PBX plan and organization time')}</Text>
              <Flex className={cls.formGrid} max>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-plan-name">{dashboardLabel('cloudAdmin.tenants.dashboard.planName', 'Название тарифа АТС', 'PBX plan name')}</Label>
                  <Input id="tenant-plan-name" value={planName} maxLength={128} onChange={(event) => setPlanName(event.target.value)} />
                </VStack>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-plan-expiry">{dashboardLabel('cloudAdmin.tenants.dashboard.expiry', 'Тариф действует до (UTC)', 'Plan expires at (UTC)')}</Label>
                  <Input id="tenant-plan-expiry" type="datetime-local" value={planExpiry} onChange={(event) => setPlanExpiry(event.target.value)} />
                </VStack>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-max-concurrent">{dashboardLabel('cloudAdmin.tenants.dashboard.concurrent', 'Макс. одновременных звонков', 'Maximum concurrent calls')}</Label>
                  <Input id="tenant-max-concurrent" type="number" min="0" max="1000000" step="1" value={maxConcurrent} aria-invalid={!concurrencyValid} onChange={(event) => setMaxConcurrent(event.target.value)} />
                  <Text className={cls.hint}>{dashboardLabel('cloudAdmin.tenants.dashboard.unknownLimit', 'Пустое поле — лимит не задан', 'Leave empty when the limit is unknown')}</Text>
                </VStack>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-timezone">{dashboardLabel('cloudAdmin.tenants.dashboard.timezone', 'Часовой пояс организации (IANA)', 'Organization timezone (IANA)')}</Label>
                  <Input id="tenant-timezone" value={timezone} placeholder="Asia/Krasnoyarsk" aria-invalid={!timezoneValid} onChange={(event) => setTimezone(event.target.value)} />
                </VStack>
              </Flex>
              <Flex className={cls.formGrid} max>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-max-ext">
                    {t('cloudAdmin.tenants.field.maxExtensions', 'Макс. внутренних номеров')}
                  </Label>
                  <Input
                    id="tenant-max-ext"
                    type="number"
                    min="1"
                    value={maxExt}
                    onChange={(e) => setMaxExt(e.target.value)}
                  />
                </VStack>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-max-trunks">
                    {t('cloudAdmin.tenants.field.maxTrunks', 'Макс. транков')}
                  </Label>
                  <Input
                    id="tenant-max-trunks"
                    type="number"
                    min="1"
                    value={maxTrunks}
                    onChange={(e) => setMaxTrunks(e.target.value)}
                  />
                </VStack>
                <VStack align="stretch" gap="8" max className={cls.field}>
                  <Label htmlFor="tenant-max-queues">
                    {t('cloudAdmin.tenants.field.maxQueues', 'Макс. очередей')}
                  </Label>
                  <Input
                    id="tenant-max-queues"
                    type="number"
                    min="1"
                    value={maxQueues}
                    onChange={(e) => setMaxQueues(e.target.value)}
                  />
                </VStack>
              </Flex>
            </VStack>
          )}
        </ModalBody>

        <DialogFooter className={cls.footer}>
          {saveError && <Text role="alert">{saveError}</Text>}
          <HStack gap="8" justify="end" max wrap="wrap">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={!isValid || isLoading}>
              {isLoading ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
            </Button>
          </HStack>
        </DialogFooter>
      </FormDialogContent>
    </Dialog>
  );
});

TenantFormModal.displayName = 'TenantFormModal';
