import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Text,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateTenantMutation,
  useUpdateTenantMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import cls from './TenantFormModal.module.scss';

type Tab = 'general' | 'limits';

export const TenantFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isModalOpen, modalMode, selectedTenant } = useAppSelector((s) => s.tenantsPage);

  const [activeTab, setActiveTab] = useState<Tab>('general');

  // Form state
  const [name, setName]           = useState('');
  const [slug, setSlug]           = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [inn, setInn]             = useState('');
  const [password, setPassword]   = useState('');
  const [adminName, setAdminName] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [maxExt, setMaxExt]       = useState('10');
  const [maxTrunks, setMaxTrunks] = useState('2');
  const [maxQueues, setMaxQueues] = useState('3');

  const [createTenant, { isLoading: isCreating }] = useCreateTenantMutation();
  const [updateTenant, { isLoading: isUpdating }] = useUpdateTenantMutation();
  const isLoading = isCreating || isUpdating;

  // Prefill on edit
  useEffect(() => {
    if (modalMode === 'edit' && selectedTenant) {
      setName(selectedTenant.name);
      setSlug(selectedTenant.slug ?? '');
      setEmail(selectedTenant.email ?? '');
      setPhone(selectedTenant.phone ?? '');
      setInn(selectedTenant.company_inn ?? '');
      setMaxExt(String(selectedTenant.max_extensions));
      setMaxTrunks(String(selectedTenant.max_trunks));
      setMaxQueues(String(selectedTenant.max_queues));
      setPassword('');
    } else {
      setName(''); setSlug(''); setEmail(''); setPhone('');
      setInn(''); setPassword(''); setAdminName('');
      setTrialDays('14');
      setMaxExt('10'); setMaxTrunks('2'); setMaxQueues('3');
    }
    setActiveTab('general');
  }, [modalMode, selectedTenant, isModalOpen]);

  const handleClose = () => dispatch(tenantsPageActions.closeModal());

  const isValid = name.trim() && email.trim() && (modalMode === 'edit' || password.trim());

  const handleSubmit = async () => {
    if (!isValid) return;
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
        }).unwrap();
      } else if (selectedTenant) {
        await updateTenant({
          id: selectedTenant.id,
          data: {
            name: name.trim(),
            slug: slug.trim() || undefined,
            email: email.trim(),
            phone: phone.trim() || undefined,
            company_inn: inn.trim() || undefined,
            max_extensions: parseInt(maxExt, 10) || 10,
            max_trunks: parseInt(maxTrunks, 10) || 2,
            max_queues: parseInt(maxQueues, 10) || 3,
          },
        }).unwrap();
      }
      handleClose();
    } catch (err) {
      console.error('Tenant form error:', err);
    }
  };

  const title = modalMode === 'create'
    ? t('cloudAdmin.tenants.createTitle', 'Новый кабинет')
    : t('cloudAdmin.tenants.editTitle', 'Редактировать кабинет');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: t('cloudAdmin.tenants.tabGeneral', 'Основные') },
    { key: 'limits',  label: t('cloudAdmin.tenants.tabLimits', 'Лимиты') },
  ];

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <VStack className={cls.tabsRow} max>
          <HStack gap="8" className="-mb-[1px] flex overflow-x-auto">
            {TABS.map((tab) => (
              <Button
                key={tab.key}
                variant="ghost"
                className={`rounded-none relative px-4 py-2 text-sm ${activeTab === tab.key ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <VStack className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary rounded-t-[1px]">{''}</VStack>
                )}
              </Button>
            ))}
          </HStack>
        </VStack>

        <VStack className={cls.scrollBody} gap="0">
          {/* ── Tab: General ─────────────────────────────────── */}
          {activeTab === 'general' && (
            <VStack gap="16">
              <div className={cls.formGrid}>
                {/* Название кабинета */}
                <VStack gap="6">
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

                {/* Slug */}
                <VStack gap="6">
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

                {/* Email */}
                <VStack gap="6">
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

                {/* Телефон */}
                <VStack gap="6">
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

                {/* ИНН */}
                <VStack gap="6">
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
              </div>

              {/* Раздел: Учётные данные администратора (только при создании) */}
              {modalMode === 'create' && (
                <div className={cls.section}>
                  <Text className={cls.sectionTitle}>
                    {t('cloudAdmin.tenants.sectionAdmin', 'Администратор кабинета')}
                  </Text>
                  <div className={cls.formGrid}>
                    <VStack gap="6">
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
                    <VStack gap="6">
                      <Label htmlFor="tenant-password">
                        {t('cloudAdmin.tenants.field.password', 'Пароль')} *
                      </Label>
                      <Input
                        id="tenant-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                      <Text className={cls.hint}>
                        {t('cloudAdmin.tenants.passwordHint', 'Пароль для входа администратора в кабинет')}
                      </Text>
                    </VStack>
                    <VStack gap="6">
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
                  </div>
                </div>
              )}
            </VStack>
          )}

          {/* ── Tab: Limits ──────────────────────────────────── */}
          {activeTab === 'limits' && (
            <VStack gap="16">
              <div className={cls.formGrid}>
                <VStack gap="6">
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
                <VStack gap="6">
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
                <VStack gap="6">
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
              </div>
            </VStack>
          )}
        </VStack>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

TenantFormModal.displayName = 'TenantFormModal';
