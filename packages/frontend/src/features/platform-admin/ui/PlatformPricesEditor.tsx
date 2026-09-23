import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, Loader, Select, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useGetPlatformPricesQuery,
  usePatchPlatformAiSkuPriceMutation,
  usePatchPlatformSubscriptionPriceMutation,
  usePostPlatformUsageRateMutation,
  type BillingPeriod,
  type IPlatformSubscriptionPrice,
} from '@/shared/api/endpoints/cloudAdminApi';
import cls from './PlatformPricesEditor.module.scss';

const PERIODS: BillingPeriod[] = ['hour', 'day', 'week', 'month', 'year', 'custom'];

function SubscriptionRow({ row }: { row: IPlatformSubscriptionPrice }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(row.amount));
  const [period, setPeriod] = useState<BillingPeriod>(row.period);
  const [intervalCount, setIntervalCount] = useState(String(row.intervalCount));
  const [save] = usePatchPlatformSubscriptionPriceMutation();

  return (
    <div className={cls.row} data-testid={`platform-price-${row.code}`}>
      <VStack gap="2" style={{ flex: 1, minWidth: 160 }}>
        <Text as="span" className={cls.name}>{row.name}</Text>
        <Text as="span" className={cls.code}>{row.code}</Text>
      </VStack>
      <div className={cls.field}>
        <Label htmlFor={`price-amount-${row.code}`} className={cls.label}>
          {t('platform.priceAmount', 'Amount, ₽')}
        </Label>
        <Input
          id={`price-amount-${row.code}`}
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className={cls.field}>
        <Label htmlFor={`price-period-${row.code}`} className={cls.label}>
          {t('platform.pricePeriod', 'Period')}
        </Label>
        <Select
          id={`price-period-${row.code}`}
          value={period}
          onChange={(e) => setPeriod(e.target.value as BillingPeriod)}
        >
          {PERIODS.map((item) => (
            <option key={item} value={item}>{t(`platform.period.${item}`, item)}</option>
          ))}
        </Select>
      </div>
      <div className={cls.fieldNarrow}>
        <Label htmlFor={`price-interval-${row.code}`} className={cls.label}>
          {t('platform.priceInterval', 'Every')}
        </Label>
        <Input
          id={`price-interval-${row.code}`}
          type="number"
          min={1}
          value={intervalCount}
          onChange={(e) => setIntervalCount(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => void save({
          code: row.code,
          amount: Number(amount),
          period,
          intervalCount: Number(intervalCount) || 1,
        })}
      >
        {t('common.save', 'Save')}
      </Button>
    </div>
  );
}

export function PlatformPricesEditor() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetPlatformPricesQuery();
  const [patchSku] = usePatchPlatformAiSkuPriceMutation();
  const [postRate, { isLoading: postingRate }] = usePostPlatformUsageRateMutation();
  const [skuDrafts, setSkuDrafts] = useState<Record<string, string>>({});
  const [usageProduct, setUsageProduct] = useState<'speech_analytics' | 'ai_voice_robots'>('speech_analytics');
  const [usageUnit, setUsageUnit] = useState<'audio_ms' | 'provider_tokens'>('audio_ms');
  const [usageRate, setUsageRate] = useState('0.01');
  const [usagePolicy, setUsagePolicy] = useState<'shadow' | 'local_byok'>('shadow');

  const subscriptions = useMemo(
    () => [...(data?.subscriptions ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data?.subscriptions],
  );

  if (isLoading) {
    return (
      <HStack justify="center" className="py-16">
        <Loader size={40} />
      </HStack>
    );
  }

  return (
    <VStack gap="20" max data-testid="platform-prices-editor">
      <Text as="h1">{t('platform.pricesTitle', 'Prices')}</Text>
      <Text variant="muted">
        {t(
          'platform.pricesHint',
          'Subscription list prices, AI SKU monthly prices and usage rates (tokens / audio). Catalog edits do not rewrite in-flight tenant cycles.',
        )}
      </Text>

      <VStack gap="8" max>
        <Text as="h2">{t('platform.pricesSubscriptions', 'Module subscriptions')}</Text>
        <div className={cls.section}>
          {subscriptions.length === 0 ? (
            <div className={cls.row}>
              <Text variant="muted">{t('platform.noModules')}</Text>
            </div>
          ) : subscriptions.map((row) => (
            <SubscriptionRow key={row.code} row={row} />
          ))}
        </div>
      </VStack>

      <VStack gap="8" max>
        <Text as="h2">{t('platform.pricesSkus', 'AI SKU monthly prices')}</Text>
        <div className={cls.section} data-testid="platform-prices-skus">
          {(data?.aiSkus ?? []).length === 0 ? (
            <div className={cls.row}>
              <Text variant="muted">{t('platform.pricesNoSkus', 'No tenant SKUs yet')}</Text>
            </div>
          ) : (data?.aiSkus ?? []).map((sku) => {
            const key = `${sku.ownerTenantUid}:${sku.skuCode}`;
            const value = skuDrafts[key] ?? String(Math.round(sku.priceMonthlyMinor) / 100);
            return (
              <div className={cls.row} key={key} data-testid={`platform-sku-${sku.skuCode}`}>
                <VStack gap="2" style={{ flex: 1, minWidth: 160 }}>
                  <Text as="span" className={cls.name}>{sku.skuCode}</Text>
                  <Text as="span" className={cls.code}>
                    {sku.product} · uid {sku.ownerTenantUid} · {sku.moneyPolicy}
                  </Text>
                </VStack>
                <div className={cls.field}>
                  <Label htmlFor={`sku-amount-${key}`} className={cls.label}>
                    {t('platform.priceMonthlyRub', '₽ / month')}
                  </Label>
                  <Input
                    id={`sku-amount-${key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={value}
                    onChange={(e) => setSkuDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void patchSku({
                    ownerTenantUid: sku.ownerTenantUid,
                    skuCode: sku.skuCode,
                    priceMonthlyMinor: Math.round(Number(value) * 100),
                    currency: sku.currency ?? 'RUB',
                    trialDays: sku.trialDays,
                  })}
                >
                  {t('common.save', 'Save')}
                </Button>
              </div>
            );
          })}
        </div>
      </VStack>

      <VStack gap="8" max>
        <Text as="h2">{t('platform.pricesUsage', 'Token / minute usage rates')}</Text>
        <div className={cls.section} data-testid="platform-prices-usage">
          {(data?.usageRates ?? []).map((rate) => (
            <div className={cls.row} key={rate.id}>
              <VStack gap="2" style={{ flex: 1 }}>
                <Text as="span" className={cls.name}>{rate.product} · {rate.unit}</Text>
                <Text as="span" className={cls.code}>
                  {rate.rate ?? '—'} {rate.currency ?? ''} · {rate.moneyPolicy}
                </Text>
              </VStack>
            </div>
          ))}
          <div className={cls.addForm}>
            <div className={cls.field}>
              <Label htmlFor="usage-product" className={cls.label}>{t('platform.pricesProduct', 'Product')}</Label>
              <Select
                id="usage-product"
                value={usageProduct}
                onChange={(e) => setUsageProduct(e.target.value as 'speech_analytics' | 'ai_voice_robots')}
              >
                <option value="speech_analytics">{t('nav.speechAnalytics', 'Speech analytics')}</option>
                <option value="ai_voice_robots">{t('nav.aiRobotsProduct', 'AI robots')}</option>
              </Select>
            </div>
            <div className={cls.field}>
              <Label htmlFor="usage-unit" className={cls.label}>{t('platform.pricesUnit', 'Unit')}</Label>
              <Select
                id="usage-unit"
                value={usageUnit}
                onChange={(e) => setUsageUnit(e.target.value as 'audio_ms' | 'provider_tokens')}
              >
                <option value="audio_ms">{t('platform.unitAudioMs', 'Audio ms')}</option>
                <option value="provider_tokens">{t('platform.unitTokens', 'Provider tokens')}</option>
              </Select>
            </div>
            <div className={cls.field}>
              <Label htmlFor="usage-rate" className={cls.label}>{t('platform.pricesRate', 'Rate')}</Label>
              <Input
                id="usage-rate"
                type="number"
                min={0}
                step="0.0001"
                value={usageRate}
                onChange={(e) => setUsageRate(e.target.value)}
                disabled={usagePolicy === 'local_byok'}
              />
            </div>
            <div className={cls.field}>
              <Label htmlFor="usage-policy" className={cls.label}>{t('platform.pricesPolicy', 'Policy')}</Label>
              <Select
                id="usage-policy"
                value={usagePolicy}
                onChange={(e) => setUsagePolicy(e.target.value as 'shadow' | 'local_byok')}
              >
                <option value="shadow">shadow</option>
                <option value="local_byok">local_byok</option>
              </Select>
            </div>
            <Button
              type="button"
              disabled={postingRate}
              onClick={() => void postRate({
                product: usageProduct,
                unit: usageUnit,
                rate: usagePolicy === 'local_byok' ? null : Number(usageRate),
                currency: usagePolicy === 'local_byok' ? null : 'RUB',
                moneyPolicy: usagePolicy,
              })}
            >
              {t('platform.pricesAddRate', 'Add rate')}
            </Button>
          </div>
        </div>
      </VStack>
    </VStack>
  );
}
