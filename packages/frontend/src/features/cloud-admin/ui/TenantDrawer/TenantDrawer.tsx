import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, ArrowRightLeft, TrendingUp, TrendingDown, RotateCcw,
  SlidersHorizontal, CircleCheck, CircleMinus, AlertCircle, Loader2,
} from 'lucide-react';
import { Button, Text, Badge } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetTenantBalanceQuery,
  useGetTenantTransactionsQuery,
  useGetTenantModulesQuery,
  useDepositBalanceMutation,
  useImpersonateTenantMutation,
} from '@/shared/api/endpoints/cloudAdminApi';
import { tenantsPageActions } from '../../model/slice/tenantsPageSlice';
import { TenantStatusBadge } from '../TenantStatusBadge';
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

  const tenantId = selectedTenant?.id ?? 0;

  const { data: balance, isLoading: balanceLoading } = useGetTenantBalanceQuery(tenantId, { skip: !isOpen || tab !== 'billing' });
  const { data: txData, isLoading: txLoading }       = useGetTenantTransactionsQuery({ tenantId, limit: 20 }, { skip: !isOpen || tab !== 'billing' });
  const { data: modules, isLoading: modulesLoading } = useGetTenantModulesQuery(tenantId, { skip: !isOpen || tab !== 'modules' });

  const [deposit, { isLoading: depositing }] = useDepositBalanceMutation();
  const [impersonate, { isLoading: impersonating }] = useImpersonateTenantMutation();

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
      const { accessToken } = await impersonate(tenantId).unwrap();
      // Store impersonation token and reload
      localStorage.setItem('impersonation_token', accessToken);
      window.location.href = '/';
    } catch (e) {
      console.error('Impersonate failed:', e);
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
                <Row label={t('cloudAdmin.drawer.email', 'Email')} value={selectedTenant.email ?? '—'} />
                <Row label={t('cloudAdmin.drawer.phone', 'Телефон')} value={selectedTenant.phone ?? '—'} />
                <Row label={t('cloudAdmin.drawer.inn', 'ИНН')} value={selectedTenant.company_inn ?? '—'} />
                <Row
                  label={t('cloudAdmin.drawer.trial', 'Пробный период до')}
                  value={selectedTenant.trial_ends_at
                    ? new Date(selectedTenant.trial_ends_at).toLocaleDateString('ru-RU')
                    : '—'
                  }
                />
                <Row
                  label={t('cloudAdmin.drawer.created', 'Создан')}
                  value={new Date(selectedTenant.created_at).toLocaleDateString('ru-RU')}
                />
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
              {modulesLoading ? (
                <HStack justify="center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></HStack>
              ) : (
                <>
                  {(modules ?? []).length === 0 && (
                    <Text variant="muted">{t('common.noData', 'Нет данных')}</Text>
                  )}
                  {(modules ?? []).map((mod) => {
                    const active = mod.status === 'active' || mod.status === 'trial';
                    return (
                      <div key={mod.module_code} className={cls.moduleRow}>
                        <div className={`${cls.moduleStatus} ${active ? cls.moduleActive : cls.moduleInactive}`}>
                          {active
                            ? <CircleCheck className="w-4 h-4" />
                            : <CircleMinus className="w-4 h-4" />
                          }
                        </div>
                        <VStack gap="2" className="flex-1 min-w-0">
                          <HStack gap="6" align="center">
                            <Text variant="small" className="font-semibold">{mod.name ?? mod.module_code}</Text>
                            {mod.is_core && <span className={cls.coreBadge}>core</span>}
                            {mod.is_paid && !mod.is_core && <span className={cls.paidBadge}>paid</span>}
                          </HStack>
                          {mod.price_monthly != null && mod.price_monthly > 0 && (
                            <Text variant="xs">
                              {mod.price_monthly.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}/мес
                            </Text>
                          )}
                        </VStack>
                        <Badge variant={active ? 'default' : 'secondary'} className="text-xs">
                          {mod.status}
                        </Badge>
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
