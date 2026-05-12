import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, CheckCircle, Lock, Zap, BarChart2, PhoneCall, Settings2, Plug } from 'lucide-react';
import {
  Card, CardHeader, CardContent, Button, Badge, Text, Loader,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetModuleCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
import cls from './MarketplacePage.module.scss';

const CATEGORY_ICONS: Record<string, any> = {
  pbx:          PhoneCall,
  calls:        Zap,
  analytics:    BarChart2,
  integrations: Plug,
  admin:        Settings2,
};

const CATEGORY_LABELS: Record<string, string> = {
  pbx:          'АТС',
  calls:        'Звонки',
  analytics:    'Аналитика',
  integrations: 'Интеграции',
  admin:        'Администрирование',
};

type Category = 'all' | 'pbx' | 'calls' | 'analytics' | 'integrations' | 'admin';

export const MarketplacePage = memo(() => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const { data: catalog, isLoading } = useGetModuleCatalogQuery();

  const categories: Category[] = ['all', 'pbx', 'calls', 'analytics', 'integrations', 'admin'];

  const filtered = catalog?.filter(
    (m) => activeCategory === 'all' || m.category === activeCategory,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader size={40} />
      </div>
    );
  }

  return (
    <VStack gap="24" className={cls.wrapper}>
      {/* Header */}
      <div className={cls.hero}>
        <div className={cls.heroContent}>
          <HStack gap="12" align="center">
            <div className={cls.heroIcon}><Package className="w-6 h-6" /></div>
            <VStack gap="4">
              <Text variant="h1">{t('marketplace.title', 'Marketplace')}</Text>
              <Text variant="muted">{t('marketplace.subtitle', 'Подключайте модули и расширяйте возможности вашей АТС')}</Text>
            </VStack>
          </HStack>
        </div>
      </div>

      {/* Category filter */}
      <div className={cls.filterBar}>
        {categories.map((cat) => {
          const Icon = cat === 'all' ? Package : CATEGORY_ICONS[cat];
          return (
            <button
              key={cat}
              className={`${cls.filterBtn} ${activeCategory === cat ? cls.filterActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {cat === 'all' ? t('marketplace.all', 'Все') : CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Module grid */}
      <div className={cls.grid}>
        {filtered?.map((mod) => {
          const Icon = CATEGORY_ICONS[mod.category] ?? Package;
          return (
            <Card key={mod.code} className={cls.moduleCard}>
              <CardHeader>
                <HStack justify="between" align="start">
                  <HStack gap="10" align="center">
                    <div className={cls.moduleIcon}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <VStack gap="4">
                      <Text variant="h4">{mod.name}</Text>
                      <Text variant="xs">{mod.code}</Text>
                    </VStack>
                  </HStack>
                  <div className={cls.badges}>
                    {mod.is_core && (
                      <span className={cls.coreBadge}>Core</span>
                    )}
                    {mod.requires_cloud && (
                      <span className={cls.cloudBadge}>Cloud</span>
                    )}
                  </div>
                </HStack>
              </CardHeader>
              <CardContent>
                <VStack gap="16">
                  {mod.description && (
                    <Text variant="muted">{mod.description}</Text>
                  )}

                  <HStack justify="between" align="center">
                    <div className={cls.price}>
                      {mod.is_paid
                        ? <><span className={cls.priceAmount}>{mod.price_monthly}</span> <span className={cls.priceCurrency}>₽/мес</span></>
                        : <span className={cls.priceFree}>{t('marketplace.free', 'Бесплатно')}</span>
                      }
                    </div>

                    {mod.is_core ? (
                      <HStack gap="6" align="center" className={cls.activeStatus}>
                        <CheckCircle className="w-4 h-4" />
                        <Text variant="small">{t('marketplace.included', 'Включён')}</Text>
                      </HStack>
                    ) : mod.requires_cloud ? (
                      <HStack gap="6" align="center" className={cls.cloudStatus}>
                        <Lock className="w-4 h-4" />
                        <Text variant="small">{t('marketplace.contactAdmin', 'Через администратора')}</Text>
                      </HStack>
                    ) : (
                      <Button size="sm" variant="outline" id={`marketplace-connect-${mod.code}`}>
                        {t('marketplace.connect', 'Подключить')}
                      </Button>
                    )}
                  </HStack>
                </VStack>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </VStack>
  );
});

MarketplacePage.displayName = 'MarketplacePage';
