import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Badge, Button, Loader, Switch, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useDisableHubModuleMutation,
  useEnableHubModuleMutation,
  useGetHubCatalogQuery,
  type IHubCatalogItem,
} from '@/shared/api/endpoints/cloudAdminApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { UserLevel } from '@krasterisk/shared';
import cls from './TenantModulesPanel.module.scss';

/**
 * Tenant System→Modules (D-22 / 006-B): enable/disable + Buy for locked.
 * Composition is read-only — no hub_module_pages membership editor.
 */
export function TenantModulesPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin =
    user?.level === UserLevel.ADMIN || user?.level === UserLevel.SUPERADMIN;

  const { data: catalog, isLoading } = useGetHubCatalogQuery(undefined, {
    skip: !user,
  });
  const [enableModule, { isLoading: enabling }] = useEnableHubModuleMutation();
  const [disableModule, { isLoading: disabling }] = useDisableHubModuleMutation();

  const handleToggle = async (item: IHubCatalogItem, nextOn: boolean) => {
    if (!isAdmin) return;
    if (!nextOn) {
      const ok = window.confirm(
        t(
          'hub.disableConfirm',
          'Disable module: access will be revoked for all tenant users. Continue?',
        ),
      );
      if (!ok) return;
      await disableModule(item.code);
      return;
    }
    await enableModule(item.code);
  };

  const handleBuy = (code: string) => {
    // Checkout lands in 08-06 — stub CTA toward Hub marketplace browse
    toast.info(t('hub.buyPlaceholder', 'Checkout will be available soon'));
    navigate('/modules');
    void code;
  };

  if (isLoading) {
    return (
      <HStack justify="center" className="py-16">
        <Loader size={40} />
      </HStack>
    );
  }

  const rows = [...(catalog ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <VStack gap="16" max data-testid="tenant-modules-panel">
      <Text as="h1">{t('nav.modules', 'Modules')}</Text>
      <Text variant="muted">{t('platform.compositionReadonly')}</Text>

      {rows.length === 0 ? (
        <Text variant="muted">{t('platform.noModules')}</Text>
      ) : (
        <div className={cls.list}>
          {rows.map((item) => {
            const isLocked = item.licenseStatus === 'locked';
            const isDisabled = item.licenseStatus === 'disabled';
            const isActive = item.licenseStatus === 'active';
            const pagesLabel = (item.pages ?? [])
              .map((p) => p.page_code)
              .join(', ');

            return (
              <div
                key={item.code}
                className={`${cls.row}${isDisabled ? ` ${cls.muted}` : ''}`}
                data-testid={`tenant-module-${item.code}`}
              >
                <div className={cls.nameBlock}>
                  <div className={cls.moduleName}>{item.name}</div>
                  <div className={cls.pages} data-testid={`tenant-module-pages-${item.code}`}>
                    {t('platform.compositionReadonly')}: {pagesLabel || '—'}
                  </div>
                </div>

                <Badge>
                  {isLocked
                    ? t('license.locked')
                    : isDisabled
                      ? t('license.disabled')
                      : t('license.active')}
                </Badge>

                <div className={cls.actions}>
                  {isLocked ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleBuy(item.code)}
                      id={`tenant-buy-${item.code}`}
                    >
                      {t('marketplace.buy', 'Buy')}
                    </Button>
                  ) : (
                    <Switch
                      checked={isActive}
                      disabled={!isAdmin || enabling || disabling || item.kind === 'base'}
                      onCheckedChange={(checked) => handleToggle(item, checked)}
                      id={`tenant-toggle-${item.code}`}
                      aria-label={`${item.name} ${t('platform.enable')}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Explicit absence of membership editor (T-08-09) */}
      <div data-testid="tenant-no-membership-editor" hidden aria-hidden />
    </VStack>
  );
}
