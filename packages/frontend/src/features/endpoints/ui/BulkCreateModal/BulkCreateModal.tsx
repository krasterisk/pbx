import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Layers } from 'lucide-react';
import { Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { selectEndpointIsBulkModalOpen } from '../../model/selectors/endpointsPageSelectors';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import { useBulkCreateEndpointsMutation, useGetBulkJobStatusQuery, useGetActiveBulkJobQuery } from '@/shared/api/endpoints/endpointApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';

const NAT_PROFILES = [
  { value: 'lan', labelKey: 'endpoints.natLan' },
  { value: 'nat', labelKey: 'endpoints.natNat' },
  { value: 'webrtc', labelKey: 'endpoints.natWebrtc' },
];

export const BulkCreateModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectEndpointIsBulkModalOpen);

  const [bulkCreate, { isLoading }] = useBulkCreateEndpointsMutation();
  const { data: contexts = [] } = useGetContextsQuery();
  
  // Check for an active job seamlessly to resume state upon reloading/re-opening modal
  const { data: activeJobData } = useGetActiveBulkJobQuery(undefined, { skip: !isOpen });

  const [extensionsPattern, setExtensionsPattern] = useState('');
  const [passwordPattern, setPasswordPattern] = useState('auto');
  const [department, setDepartment] = useState('');
  const [context, setContext] = useState('');
  const [natProfile, setNatProfile] = useState('nat');
  const [codecs] = useState('ulaw,alaw,g722');
  const [result, setResult] = useState<{ created?: string[]; skipped?: string[]; total: number } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If we just loaded the modal and discovered an active job, snap to it.
    if (activeJobData?.jobId && !jobId && !result) {
      setJobId(activeJobData.jobId);
    }
  }, [activeJobData, jobId, result]);

  const { data: jobStatus } = useGetBulkJobStatusQuery(jobId || '', {
    skip: !jobId,
    pollingInterval: 1000,
  });

  const handleClose = useCallback(() => {
    dispatch(endpointsPageActions.closeBulkModal());
    setResult(null);
    setJobId(null);
    setError(null);
    setIsSubmitting(false);
  }, [dispatch]);

  useEffect(() => {
    if (jobStatus) {
      if (jobStatus.status === 'completed' || jobStatus.status === 'error') {
        setResult({
          created: jobStatus.created,
          skipped: jobStatus.skipped,
          total: jobStatus.total,
        });
        if (jobStatus.status === 'error') {
          console.error("Job error:", jobStatus.error);
        }
        setJobId(null);
      }
    }
  }, [jobStatus]);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await bulkCreate({
        extensionsPattern,
        passwordPattern,
        department: department || undefined,
        context: context || undefined,
        codecs,
        natProfile,
      }).unwrap();
      
      if (res.jobId) {
        setJobId(res.jobId);
      } else {
        setResult(res);
      }
    } catch (e: any) {
      console.error('Bulk create failed:', e);
      setError(e?.data?.message || e?.message || 'Ошибка создания абонентов');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedExtensions = useCallback(() => {
    const result = new Set<number>();
    const parts = extensionsPattern.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          // Limit UI parsing to a reasonable max like 5000 to prevent browser freeze
          const maxEnd = Math.min(end, start + 5000);
          for (let i = start; i <= maxEnd; i++) {
            result.add(i);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num)) {
          result.add(num);
        }
      }
    }
    return Array.from(result);
  }, [extensionsPattern]);

  const range = parsedExtensions().length;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-6 z-50 shadow-2xl max-h-[85vh] overflow-y-auto">
          <HStack justify="between" align="center" className="mb-6">
            <HStack gap="8" align="center">
              <Layers className="w-5 h-5 text-primary" />
              <Dialog.Title className="text-xl font-bold">
                {t('endpoints.bulkTitle')}
              </Dialog.Title>
            </HStack>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </HStack>

          {jobStatus && (jobStatus.status === 'pending' || jobStatus.status === 'processing') ? (
            <VStack gap="16" className="py-8">
              <HStack justify="center" align="center" className="mb-2">
                <p className="text-base font-semibold text-primary">Создание абонентов...</p>
              </HStack>
              <div className="w-full bg-accent rounded-full h-6 overflow-hidden relative border border-border shadow-inner">
                <div 
                  className="bg-primary h-full transition-all duration-500 ease-out flex items-center justify-end"
                  style={{ width: `${Math.max(5, Math.round((jobStatus.processed / jobStatus.total) * 100))}%` }}
                >
                  <div className="w-full h-full bg-white/20 animate-pulse" />
                </div>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground drop-shadow-sm">
                  {Math.round((jobStatus.processed / jobStatus.total) * 100)}% ({jobStatus.processed} / {jobStatus.total})
                </span>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">Процесс продолжится в фоне, даже если закрыть окно</p>
            </VStack>
          ) : result ? (
            <VStack gap="16">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <p className="text-emerald-400 font-semibold text-lg mb-2">
                  {t('common.success')}!
                </p>
                <p className="text-sm">{t('endpoints.bulkCreated', { count: result.total })}</p>
                {(result.skipped?.length || 0) > 0 && (
                  <p className="text-sm text-yellow-400 mt-1">
                    {t('endpoints.bulkSkipped', { count: result.skipped?.length })}:{' '}
                    {result.skipped?.join(', ')}
                  </p>
                )}
              </div>
              <Button onClick={handleClose} className="w-full">
                {t('common.confirm')}
              </Button>
            </VStack>
          ) : (
            <VStack gap="16">
              {/* Range */}
              <VStack gap="4">
                <label htmlFor="bulk-pattern" className="text-sm font-medium text-muted-foreground">{t('endpoints.bulkExtensionsPattern', 'Номера (например: 101,106,110-120)')}</label>
                <Input
                  id="bulk-pattern"
                  value={extensionsPattern}
                  onChange={(e) => setExtensionsPattern(e.target.value)}
                  placeholder="101,106,110-120"
                  className="font-mono"
                />
              </VStack>

              {!isNaN(range) && range > 0 && (
                <VStack gap="4">
                  <p className="text-xs text-muted-foreground">
                    Будет создано: <span className="text-primary font-semibold">{range}</span> абонентов
                  </p>
                  {range > 200 && (
                    <p className="text-xs text-blue-400">
                      Большой объем данных. Операция будет выполнена в фоновом режиме (асинхронно).
                    </p>
                  )}
                </VStack>
              )}

              {/* Password pattern */}
              <VStack gap="4">
                <label htmlFor="bulk-password" className="text-sm font-medium text-muted-foreground">{t('endpoints.bulkPasswordPattern')}</label>
                <Input
                  id="bulk-password"
                  value={passwordPattern}
                  onChange={(e) => setPasswordPattern(e.target.value)}
                  placeholder="auto"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">{t('endpoints.bulkPasswordAuto')}</p>
              </VStack>


              {/* Department */}
              <VStack gap="4">
                <label htmlFor="bulk-dept" className="text-sm font-medium text-muted-foreground">{t('endpoints.department', 'Отдел')}</label>
                <Input
                  id="bulk-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Бухгалтерия"
                />
                <p className="text-xs text-muted-foreground">Одинаковый для всех созданных абонентов</p>
              </VStack>

              {/* Context */}
              <VStack gap="4">
                <label htmlFor="bulk-ctx" className="text-sm font-medium text-muted-foreground">{t('endpoints.context')}</label>
                <select
                  id="bulk-ctx"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
                >
                  <option value="">— Default —</option>
                  {contexts.map((c) => (
                    <option key={c.uid} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </VStack>

              {/* NAT Profile */}
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">{t('endpoints.natProfile')}</label>
                <HStack gap="8">
                  {NAT_PROFILES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setNatProfile(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        natProfile === p.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {t(p.labelKey)}
                    </button>
                  ))}
                </HStack>
              </VStack>

              {/* Error */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Actions */}
              <HStack gap="8" justify="end" className="mt-4">
                <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || isLoading || isNaN(range) || range <= 0 || !context}>
                  {isSubmitting ? (
                    <><span className="animate-spin mr-2">⏳</span> Отправка...</>
                  ) : (
                    `${t('common.add')} (${range})`
                  )}
                </Button>
              </HStack>
            </VStack>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

