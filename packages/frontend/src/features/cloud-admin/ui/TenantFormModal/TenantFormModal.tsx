import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Text, Select, PasswordInput,
} from '@/shared/ui';
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
  const { t } = useTranslation();
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
      setSellerId(selectedTenant.seller_id);
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
      const def = sellers.find((s) => s.isDefault) ?? sellers[0];
      setSellerId(def?.id ?? '');
    }
    setActiveTab('general');
  }, [modalMode, selectedTenant, isModalOpen, sellers]);

  const handleClose = () => dispatch(tenantsPageActions.closeModal());

  const isValid = Boolean(
    name.trim()
    && email.trim()
    && sellerId
    && (modalMode === 'edit' || password.trim()),
  );

  const handleSubmit = async () => {
    if (!isValid || !sellerId) return;
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
          seller_id: sellerId,
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
            seller_id: sellerId,
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
    { key: 'limits', label: t('cloudAdmin.tenants.tabLimits', 'Лимиты') },
  ];

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="large" className={cls.dialog} data-testid="tenant-form-modal">
        <DialogHeader className={cls.header}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Flex direction="column" className={cls.tabsWrap} max>
          <Flex className={cls.tabsRow} role="tablist" max>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={[cls.tab, activeTab === tab.key && cls.tabActive].filter(Boolean).join(' ')}
                onClick={() => setActiveTab(tab.key)}
              >
                <Text as="span">{tab.label}</Text>
              </button>
            ))}
          </Flex>
        </Flex>

        <VStack className={cls.scrollBody} gap="0" max>
          {activeTab === 'general' && (
            <VStack gap="16" max>
              <Flex className={cls.formGrid} max>
                <VStack gap="8" max className={cls.field}>
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

                <VStack gap="8" max className={cls.field}>
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

                <VStack gap="8" max className={cls.field}>
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

                <VStack gap="8" max className={cls.field}>
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

                <VStack gap="8" max className={cls.field}>
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

                <VStack gap="8" max className={cls.field}>
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

              {modalMode === 'create' && (
                <VStack gap="12" max className={cls.section}>
                  <Text className={cls.sectionTitle}>
                    {t('cloudAdmin.tenants.sectionAdmin', 'Администратор кабинета')}
                  </Text>
                  <Flex className={cls.formGrid} max>
                    <VStack gap="8" max className={cls.field}>
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
                    <VStack gap="8" max className={cls.field}>
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
                    <VStack gap="8" max className={cls.field}>
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
            <VStack gap="16" max>
              <Flex className={cls.formGrid} max>
                <VStack gap="8" max className={cls.field}>
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
                <VStack gap="8" max className={cls.field}>
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
                <VStack gap="8" max className={cls.field}>
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
        </VStack>

        <DialogFooter className={cls.footer}>
          <HStack gap="8" justify="end" max wrap="wrap">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={!isValid || isLoading}>
              {isLoading ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

TenantFormModal.displayName = 'TenantFormModal';
