import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Network, Share2, Eye, Upload } from 'lucide-react';
import { Button, Card, CardContent } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetContextsQuery, useLazyPreviewDialplanQuery, useApplyDialplanMutation } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '../../model/slice/routesSlice';
import { RoutesTable } from '../RoutesTable/RoutesTable';
import { RouteFormModal } from '../RouteFormModal/RouteFormModal';
import { RawDialplanEditor } from '../RawDialplanEditor/RawDialplanEditor';
import styles from './RoutesPage.module.scss';

export const RoutesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selectedContextUid = useAppSelector((s) => s.routes.selectedContextUid);

  const { data: contexts = [] } = useGetContextsQuery();
  const [triggerPreview] = useLazyPreviewDialplanQuery();
  const [applyDialplan, { isLoading: isApplying }] = useApplyDialplanMutation();

  const [previewDialplan, setPreviewDialplan] = useState<string | null>(null);

  const handleContextChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const uid = Number(e.target.value);
    dispatch(routesActions.selectContext(uid));
    setPreviewDialplan(null);
  }, [dispatch]);

  const handlePreview = useCallback(async () => {
    if (!selectedContextUid) return;
    try {
      const result = await triggerPreview(selectedContextUid).unwrap();
      setPreviewDialplan(result.dialplan);
    } catch (err) {
      console.error('Preview failed:', err);
    }
  }, [selectedContextUid, triggerPreview]);

  const handleApply = useCallback(async () => {
    if (!selectedContextUid) return;
    if (!confirm(t('routes.confirmApply', 'Применить dialplan на сервер Asterisk? Текущий контекст будет перезаписан.'))) return;
    try {
      await applyDialplan(selectedContextUid).unwrap();
      alert(t('routes.applySuccess', 'Dialplan успешно применён!'));
    } catch (err) {
      console.error('Apply failed:', err);
    }
  }, [selectedContextUid, applyDialplan, t]);

  const selectedContextName = contexts.find((c) => c.uid === selectedContextUid)?.name;

  return (
    <VStack gap="16" max>
      <h1 className={styles.title}>{t('routes.title', 'Маршрутизация')}</h1>

      {/* Toolbar: Context Selector + Buttons */}
      <Card>
        <CardContent className={styles.toolbar}>
          <HStack gap="12" align="center" className={styles.toolbarWrap}>
            <HStack gap="8" align="center">
              <Network className="w-5 h-5 text-primary" />
              <select
                id="context-selector"
                className={styles.contextSelect}
                value={selectedContextUid || ''}
                onChange={handleContextChange}
              >
                <option value="" disabled>{t('routes.selectContext', '— Выберите контекст —')}</option>
                {contexts.map((ctx) => (
                  <option key={ctx.uid} value={ctx.uid}>
                    {ctx.name} {ctx.comment ? `(${ctx.comment})` : ''}
                  </option>
                ))}
              </select>
            </HStack>

            <HStack gap="8">
              {selectedContextUid && (
                <>
                  <Button variant="default" size="sm" onClick={() => dispatch(routesActions.openCreateModal())}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t('routes.addRoute', 'Новый маршрут')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePreview}>
                    <Eye className="w-4 h-4 mr-1" />
                    {t('routes.preview', 'Предпросмотр')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleApply} disabled={isApplying}>
                    <Upload className="w-4 h-4 mr-1" />
                    {t('routes.apply', 'Применить')}
                  </Button>
                </>
              )}
            </HStack>
          </HStack>
        </CardContent>
      </Card>

      {/* Routes Table */}
      <RoutesTable />

      {/* Dialplan Preview */}
      {previewDialplan !== null && (
        <Card>
          <CardContent className="p-4">
            <HStack justify="between" align="center" className="mb-3">
              <span className={styles.previewTitle}>
                {t('routes.dialplanPreview', 'Предпросмотр dialplan')}: {selectedContextName}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewDialplan(null)}>✕</Button>
            </HStack>
            <RawDialplanEditor value={previewDialplan} onChange={() => {}} readonly />
          </CardContent>
        </Card>
      )}

      {/* Route Form Modal */}
      <RouteFormModal />
    </VStack>
  );
});

RoutesPage.displayName = 'RoutesPage';
