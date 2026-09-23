import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, ArrowRightLeft, TrendingUp, TrendingDown, RotateCcw,
  SlidersHorizontal, AlertCircle, Loader2,
} from 'lucide-react';
import {
  useGetTenantBalanceQuery,
  useGetTenantTransactionsQuery,
  useGetTenantHubCatalogQuery,
  useDepositBalanceMutation,
  useImpersonateTenantMutation,
  useEnableTenantHubModuleMutation,
  useDisableTenantHubModuleMutation,
  useGrantTenantHubModuleMutation,
  useGetSellersQuery,
  useUpdateTenantMutation,
  type IHubCatalogItem,
} from '@/shared/api/endpoints/cloudAdminApi';
import { Button, Text, Switch, Select, Label } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import { TenantStatusBadge } from '../TenantStatusBadge';
import { rememberImpersonation, persistImpersonatedUser } from '@/features/auth/lib/impersonationSession';
import { toast } from 'react-toastify';
import cls from './TenantDrawer.module.scss';

type DrawerTab = 'info' | 'billing' | 'modules';

const TX_ICONS: Record<string, { icon: typeof TrendingUp; cls: string }> = {
  deposit:    { icon: TrendingUp,   cls: cls.txDeposit },
  charge:     { icon: TrendingDown, cls: cls.txCharge },
  refund:     { icon: RotateCcw,    cls: cls.txRefund },
  correction: { icon: SlidersHorizontal, cls: cls.txCorrection },
};

export const TenantDrawer = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { selectedTenant, isModalOpen } = useAppSelector((s) => s.tenantsPage);

  // Drawer is open when a tenant is selected AND the edit modal is NOT open
  const isOpen = !!selectedTenant && !isModalOpen;

  const [tab, setTab] = useState<DrawerTab>('info');
  const [depositAmount, setDepositAmount] = useState('');
  const [trialDaysByCode, setTrialDaysByCode] = useState<Record<string, string>>({});

  const tenantId = selectedTenant?.id ?? 0;

  const { data: balance, isLoading: balanceLoading } = useGetTenantBalanceQuery(tenantId, { skip: !isOpen || tab !== 'billing' });
  const { data: txData, isLoading: txLoading }       = useGetTenantTransactionsQuery({ tenantId, limit: 20 }, { skip: !isOpen || tab !== 'billing' });
  const { data: modules, isLoading: modulesLoading } = useGetTenantHubCatalogQuery(tenantId, { skip: !isOpen || tab !== 'modules' });
  const { data: sellers = [] } = useGetSellersQuery(undefined, { skip: !isOpen });

  const [deposit, { isLoading: depositing }] = useDepositBalanceMutation();
  const [impersonate, { isLoading: impersonating }] = useImpersonateTenantMutation();
  const [enableHubModule, { isLoading: enablingHub }] = useEnableTenantHubModuleMutation();
  const [disableHubModule, { isLoading: disablingHub }] = useDisableTenantHubModuleMutation();
  const [grantHubModule, { isLoading: grantingHub }] = useGrantTenantHubModuleMutation();
  const [updateTenant, { isLoading: updatingSeller }] = useUpdateTenantMutation();

  useEffect(() => {
    if (isOpen) setTab('info');
  }, [tenantId, isOpen]);

  const handleClose = () => dispatch(tenantsPageActions.closeModal());

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) return;
    await deposit({ tenantId, amountRub: amt }).unwrap();
    setDepositAmount('');
  };

  const handleImpersonate = async () => {
    try {
      const { accessToken, user } = await impersonate(tenantId).unwrap();
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('impersonation_token', accessToken);
      if (selectedTenant) rememberImpersonation(selectedTenant);
      if (user?.uniqueid) persistImpersonatedUser(user);
      window.location.href = '/';
    } catch (e) {
      console.error('Impersonate failed:', e);
    }
  };

  const handleHubToggle = async (item: IHubCatalogItem, nextOn: boolean) => {
    if (item.kind === 'base') return;
    if (!nextOn) {
      const ok = window.confirm(
        t('cloudAdmin.drawer.disableConfirm', 'Disable this module for {{name}}?', { name: selectedTenant?.name ?? '' }),
      );
      if (!ok) return;
      try {
        await disableHubModule({ tenantId, code: item.code }).unwrap();
      } catch (e) {
        toast.error(hubModuleErrorMessage(e, t));
      }
      return;
    }
    try {
      await enableHubModule({ tenantId, code: item.code }).unwrap();
    } catch (e) {
      toast.error(hubModuleErrorMessage(e, t));
    }
  };

  const handleGrant = async (item: IHubCatalogItem, access: 'open' | 'trial') => {
    const rawDays = Number(trialDaysByCode[item.code] ?? '14');
    try {
      await grantHubModule({
        tenantId,
        code: item.code,
        access,
        trialDays: access === 'trial' ? rawDays : undefined,
      }).unwrap();
    } catch (e) {
      toast.error(hubModuleErrorMessage(e, t));
    }
  };

  const handleSellerChange = async (nextSellerId: number) => {
    if (!selectedTenant || selectedTenant.seller_id === nextSellerId) return;
    try {
      const updated = await updateTenant({
        id: selectedTenant.id,
        data: { seller_id: nextSellerId },
      }).unwrap();
      const seller = sellers.find((s) => s.id === nextSellerId);
      dispatch(tenantsPageActions.openTenantDrawer({
        ...selectedTenant,
        ...updated,
        seller_id: nextSellerId,
        seller: seller ? { id: seller.id, name: seller.name } : selectedTenant.seller,
      }));
    } catch (e) {
      console.error('Seller update failed:', e);
    }
  };

  if (!isOpen || !selectedTenant) return null;

  const TABS: { key: DrawerTab; label: string }[] = [
    { key: 'info',    label: t('cloudAdmin.drawer.tabInfo', 'Инфо') },
    { key: 'billing', label: t('cloudAdmin.drawer.tabBilling', 'Биллинг') },
    { key: 'modules', label: t('cloudAdmin.drawer.tabModules', 'Модули') },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className={cls.backdrop} onClick={handleClose} />

      {/* Drawer */}
      <aside className={cls.drawer} role="dialog" aria-modal="true">

        {/* ── Header ──────────────────────────────────── */}
        <div className={cls.header}>
          <HStack justify="between" align="start">
            <VStack gap="4">
              <Text variant="h4">{selectedTenant.name}</Text>
              <HStack gap="8" align="center">
                <TenantStatusBadge status={selectedTenant.status} />
                {selectedTenant.slug && (
                  <Text variant="xs">/{selectedTenant.slug}</Text>
                )}
              </HStack>
            </VStack>
            <button onClick={handleClose} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </HStack>

          <Button
            id="tenant-impersonate-btn"
            variant="outline"
            size="sm"
            className={cls.impersonateBtn}
            onClick={handleImpersonate}
            disabled={impersonating}
          >
            {impersonating
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <ArrowRightLeft className="w-4 h-4 mr-2" />
            }
            {t('cloudAdmin.drawer.impersonate', 'Войти в кабинет')}
          </Button>

          {/* Tabs */}
          <div className={cls.tabs}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                className={`${cls.tab} ${tab === key ? cls.tabActive : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────── */}
        <div className={cls.body}>

          {/* ── Tab: Info ─────────────────────────────── */}
          {tab === 'info' && (
            <VStack gap="16">
              <VStack gap="8" className={cls.infoGrid}>
                <Row label={t('cloudAdmin.drawer.email', 'Email')} value={selectedTenant.email ?? '-'} />
                <Row label={t('cloudAdmin.drawer.phone', 'Телефон')} value={selectedTenant.phone ?? '-'} />
                <Row label={t('cloudAdmin.drawer.inn', 'ИНН')} value={selectedTenant.company_inn ?? '-'} />
                <Row
                  label={t('cloudAdmin.drawer.trial', 'Пробный период до')}
                  value={selectedTenant.trial_ends_at
                    ? new Date(selectedTenant.trial_ends_at).toLocaleDateString('ru-RU')
                    : '-'
                  }
                />
                <Row
                  label={t('cloudAdmin.drawer.created', 'Создан')}
                  value={new Date(selectedTenant.created_at).toLocaleDateString('ru-RU')}
                />
              </VStack>

              <VStack gap="6">
                <Label htmlFor="drawer-seller">
                  {t('cloudAdmin.drawer.seller', 'Поставщик')}
                </Label>
                <Select
                  id="drawer-seller"
                  data-testid="drawer-seller-select"
                  value={String(selectedTenant.seller_id ?? '')}
                  disabled={updatingSeller}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id) void handleSellerChange(id);
                  }}
                >
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.isDefault ? ` (${t('cloudAdmin.sellers.defaultBadge', 'по умолчанию')})` : ''}
                    </option>
                  ))}
                </Select>
              </VStack>

              <VStack gap="8">
                <Text variant="xs" className="font-semibold uppercase">
                  {t('cloudAdmin.drawer.limits', 'ЛИМИТЫ').toUpperCase()}
                </Text>
                <div className={cls.limitsGrid}>
                  <LimitCard label={t('cloudAdmin.drawer.extensions', 'Номеров')} value={selectedTenant.max_extensions} />
                  <LimitCard label={t('cloudAdmin.drawer.trunks', 'Транков')} value={selectedTenant.max_trunks} />
                  <LimitCard label={t('cloudAdmin.drawer.queues', 'Очередей')} value={selectedTenant.max_queues} />
                </div>
              </VStack>
            </VStack>
          )}

          {/* ── Tab: Billing ──────────────────────────── */}
          {tab === 'billing' && (
            <VStack gap="16">
              {/* Balance card */}
              {balanceLoading ? (
                <HStack justify="center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></HStack>
              ) : balance && (
                <div className={`${cls.balanceCard} ${balance.is_blocked ? cls.balanceBlocked : ''}`}>
                  <Text variant="xs">{t('cloudAdmin.drawer.balance', 'Баланс')}</Text>
                  <div className={cls.balanceAmount}>
                    {balance.balance_rub.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                  </div>
                  {balance.is_blocked && (
                    <HStack gap="4" align="center" className={cls.blockedBadge}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('cloudAdmin.drawer.blocked', 'Заблокирован')}
                    </HStack>
                  )}
                </div>
              )}

              {/* Quick deposit */}
              <VStack gap="8">
                <Text variant="small" className="font-semibold">{t('cloudAdmin.drawer.deposit', 'Пополнить баланс')}</Text>
                <HStack gap="8">
                  <input
                    type="number"
                    min="1"
                    step="100"
                    placeholder="Сумма, ₽"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <Button
                    id="tenant-deposit-btn"
                    size="sm"
                    onClick={handleDeposit}
                    disabled={!depositAmount || depositing}
                  >
                    {depositing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('cloudAdmin.drawer.depositBtn', 'Зачислить')}
                  </Button>
                </HStack>
              </VStack>

              {/* Transactions */}
              <VStack gap="8">
                <Text variant="small" className="font-semibold">{t('cloudAdmin.drawer.history', 'История операций')}</Text>
                {txLoading ? (
                  <HStack justify="center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></HStack>
                ) : (
                  <div className={cls.txList}>
                    {(txData?.rows ?? []).length === 0 && (
                      <Text variant="muted">{t('common.noData', 'Нет данных')}</Text>
                    )}
                    {(txData?.rows ?? []).map((tx) => {
                      const meta = TX_ICONS[tx.type] ?? TX_ICONS.correction;
                      const Icon = meta.icon;
                      const isPositive = tx.type === 'deposit' || tx.type === 'refund';
                      return (
                        <div key={tx.id} className={cls.txRow}>
                          <div className={`${cls.txIcon} ${meta.cls}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <VStack gap="2" className="flex-1 min-w-0">
                            <Text variant="xs" className="truncate">{tx.description ?? tx.type}</Text>
                            <Text variant="xs">
                              {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                            </Text>
                          </VStack>
                          <Text
                            variant="small"
                            className={`font-semibold ${isPositive ? cls.amountPositive : cls.amountNegative}`}
                          >
                            {isPositive ? '+' : '−'}
                            {tx.amount_rub.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                          </Text>
                        </div>
                      );
                    })}
                  </div>
                )}
              </VStack>
            </VStack>
          )}

          {/* ── Tab: Modules ──────────────────────────── */}
          {tab === 'modules' && (
            <VStack gap="8">
              <Text variant="muted">
                {t('cloudAdmin.drawer.modulesFor', 'Modules for {{name}}', { name: selectedTenant.name })}
              </Text>
              {modulesLoading ? (
                <HStack justify="center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></HStack>
              ) : (
                <>
                  {(modules ?? []).length === 0 && (
                    <Text variant="muted">{t('common.noData', 'Нет данных')}</Text>
                  )}
                  {[...(modules ?? [])]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((mod) => {
                      const locked = mod.licenseStatus === 'locked';
                      const active = mod.licenseStatus === 'active';
                      const until = mod.accessUntil
                        ? new Date(mod.accessUntil).toLocaleDateString('ru-RU')
                        : null;
                      return (
                        <div key={mod.code} className={cls.moduleRow} data-testid={`platform-tenant-module-${mod.code}`}>
                          <VStack gap="2" className="flex-1 min-w-0">
                            <Text variant="small" className="font-semibold">{mod.name}</Text>
                            <Text variant="xs">
                              {t(`cloudAdmin.drawer.licenseStatus.${mod.licenseStatus}`, mod.licenseStatus)}
                              {until ? ` · ${t('cloudAdmin.drawer.accessUntil', 'до {{date}}', { date: until })}` : ''}
                            </Text>
                            {locked && (
                              <Text variant="xs" className={cls.aiLockedHint}>
                                {t(
                                  'cloudAdmin.drawer.grantHint',
                                  'Открыть без срока или выдать триал на указанное число дней.',
                                )}
                              </Text>
                            )}
                          </VStack>
                          {locked ? (
                            <HStack gap="4" align="center">
                              <input
                                className={cls.trialDays}
                                type="number"
                                min={1}
                                max={365}
                                aria-label={t('cloudAdmin.drawer.trialDays', 'Дней триала')}
                                data-testid={`platform-tenant-trial-days-${mod.code}`}
                                value={trialDaysByCode[mod.code] ?? '14'}
                                onChange={(event) => setTrialDaysByCode((prev) => ({
                                  ...prev,
                                  [mod.code]: event.target.value,
                                }))}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                data-testid={`platform-tenant-trial-${mod.code}`}
                                disabled={grantingHub}
                                onClick={() => void handleGrant(mod, 'trial')}
                              >
                                {t('cloudAdmin.drawer.trial', 'Триал')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                data-testid={`platform-tenant-grant-${mod.code}`}
                                disabled={grantingHub}
                                onClick={() => void handleGrant(mod, 'open')}
                              >
                                {t('cloudAdmin.drawer.openAccess', 'Открыть')}
                              </Button>
                            </HStack>
                          ) : (
                            <Switch
                              checked={active}
                              disabled={mod.kind === 'base' || enablingHub || disablingHub}
                              onCheckedChange={(checked) => void handleHubToggle(mod, checked)}
                              aria-label={`${mod.name} ${selectedTenant.name}`}
                            />
                          )}
                        </div>
                      );
                    })}
                </>
              )}
            </VStack>
          )}
        </div>
      </aside>
    </>
  );
});

TenantDrawer.displayName = 'TenantDrawer';

function hubModuleErrorMessage(
  err: unknown,
  t: (key: string, fallback?: string) => string,
): string {
  const data = (err as { data?: { code?: string; product?: string } })?.data
    ?? (err as { error?: { data?: { code?: string } } })?.error?.data;
  const code = data?.code;
  if (code === 'sku_not_found' || code === 'trial_days_invalid' || code === 'grant_invalid') {
    return t(`cloudAdmin.drawer.grantError.${code}`, code);
  }
  if (code === 'license_invalid' || code === 'license_expired'
    || code === 'not_entitled' || code === 'product_disabled'
    || code === 'entitlement_expired') {
    return t(`aiProducts.access.reasons.${code}`, code);
  }
  return t('common.error', 'Ошибка');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="between" align="start" className="py-2 border-b border-border/50 last:border-0">
      <Text variant="muted">{label}</Text>
      <Text variant="small" className="text-right max-w-[60%] break-words">{value}</Text>
    </HStack>
  );
}

function LimitCard({ label, value }: { label: string; value: number }) {
  return (
    <VStack gap="2" align="center" className="bg-muted/40 rounded-lg p-3 text-center">
      <Text variant="h3">{value}</Text>
      <Text variant="xs">{label}</Text>
    </VStack>
  );
}
