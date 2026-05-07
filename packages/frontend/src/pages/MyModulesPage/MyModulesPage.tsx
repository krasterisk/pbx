import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, CheckCircle2, Clock, XCircle, Store, PhoneCall, Zap, BarChart2, Plug, Settings2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Text, Loader } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useMyModules } from '@/shared/hooks/useMyModules';
import { useNavigate } from 'react-router-dom';
import cls from './MyModulesPage.module.scss';

const CATEGORY_ICONS: Record<string, any> = {
  pbx:          PhoneCall,
  calls:        Zap,
  analytics:    BarChart2,
  integrations: Plug,
  admin:        Settings2,
};

const STATUS_CONFIG = {
  active:   { label: 'Активен',   icon: CheckCircle2, cls: 'active' },
  trial:    { label: 'Пробный',   icon: Clock,         cls: 'trial'  },
  inactive: { label: 'Неактивен', icon: XCircle,       cls: 'inactive' },
} as const;

export const MyModulesPage = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { modules, isLoading } = useMyModules();

  if (isLoading) {
    return (
      <div className={cls.loaderWrap}>
        <Loader size="lg" />
      </div>
    );
  }

  const active   = modules.filter((m) => m.status === 'active');
  const inactive = modules.filter((m) => m.status !== 'active');

  return (
    <VStack gap="24" className={cls.wrapper}>
      {/* Header */}
      <HStack justify="between" align="center" max>
        <VStack gap="4">
          <Text size="xl" weight="bold">{t('myModules.title', 'Мои модули')}</Text>
          <Text color="muted">{t('myModules.subtitle', 'Подключённые и доступные расширения вашей АТС')}</Text>
        </VStack>
        <Button onClick={() => navigate('/marketplace')} id="my-modules-to-marketplace-btn">
          <Store className="w-4 h-4 mr-2" />
          {t('myModules.marketplace', 'Marketplace')}
        </Button>
      </HStack>

      {/* Stats row */}
      <div className={cls.statsRow}>
        <div className={`${cls.statChip} ${cls.statChipActive}`}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{active.length} активных</span>
        </div>
        {inactive.length > 0 && (
          <div className={cls.statChip}>
            <XCircle className="w-4 h-4" />
            <span>{inactive.length} неактивных</span>
          </div>
        )}
      </div>

      {/* Active modules */}
      {active.length > 0 && (
        <VStack gap="12">
          <Text weight="semibold" color="muted" size="sm" className={cls.sectionTitle}>
            АКТИВНЫЕ МОДУЛИ
          </Text>
          <div className={cls.grid}>
            {active.map((mod) => {
              const Icon = CATEGORY_ICONS[mod.category ?? ''] ?? Package;
              const cfg = STATUS_CONFIG['active'];
              return (
                <Card key={mod.module_code} className={`${cls.moduleCard} ${cls.moduleCardActive}`}>
                  <CardHeader>
                    <HStack justify="between" align="center">
                      <HStack gap="10" align="center">
                        <div className={cls.iconWrap}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <VStack gap="2">
                          <Text weight="semibold">{mod.name ?? mod.module_code}</Text>
                          <Text size="xs" color="muted">{mod.module_code}</Text>
                        </VStack>
                      </HStack>
                      <span className={`${cls.statusBadge} ${cls[`status_${cfg.cls}`]}`}>
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </HStack>
                  </CardHeader>
                  <CardContent>
                    {mod.description && <Text size="sm" color="muted">{mod.description}</Text>}
                    <div className={cls.price}>
                      {mod.is_paid
                        ? <><span className={cls.priceAmt}>{mod.price_monthly}</span> <span className={cls.priceCur}>₽/мес</span></>
                        : <span className={cls.priceFree}>Бесплатно</span>
                      }
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </VStack>
      )}

      {/* Inactive modules */}
      {inactive.length > 0 && (
        <VStack gap="12">
          <Text weight="semibold" color="muted" size="sm" className={cls.sectionTitle}>
            НЕАКТИВНЫЕ МОДУЛИ
          </Text>
          <div className={cls.grid}>
            {inactive.map((mod) => {
              const Icon = CATEGORY_ICONS[mod.category ?? ''] ?? Package;
              const status = (mod.status ?? 'inactive') as keyof typeof STATUS_CONFIG;
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['inactive'];
              return (
                <Card key={mod.module_code} className={`${cls.moduleCard} ${cls.moduleCardInactive}`}>
                  <CardHeader>
                    <HStack justify="between" align="center">
                      <HStack gap="10" align="center">
                        <div className={`${cls.iconWrap} ${cls.iconWrapDim}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <VStack gap="2">
                          <Text weight="semibold">{mod.name ?? mod.module_code}</Text>
                          <Text size="xs" color="muted">{mod.module_code}</Text>
                        </VStack>
                      </HStack>
                      <span className={`${cls.statusBadge} ${cls[`status_${cfg.cls}`]}`}>
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </HStack>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </VStack>
      )}

      {modules.length === 0 && (
        <VStack gap="16" align="center" className={cls.empty}>
          <Package className="w-12 h-12 opacity-30" />
          <Text color="muted">{t('myModules.empty', 'Нет подключённых модулей')}</Text>
          <Button onClick={() => navigate('/marketplace')} id="my-modules-empty-marketplace-btn">
            <Store className="w-4 h-4 mr-2" />
            Перейти в Marketplace
          </Button>
        </VStack>
      )}
    </VStack>
  );
});

MyModulesPage.displayName = 'MyModulesPage';
