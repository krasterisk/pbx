import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { useGetAutodialCapabilitiesQuery } from '@/shared/api/endpoints/autodialApi';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';
import cls from './AutodialAiAction.module.scss';

export function AutodialAiAction({ seed }: { seed: string }) {
  const { t } = useTranslation(), dispatch = useAppDispatch(), hintId = useId();
  const level = useAppSelector((state) => state.auth?.user?.level);
  const { currentData: capabilities, isFetching, isError, refetch } = useGetAutodialCapabilitiesQuery();
  const ready = capabilities?.ai?.configured === true;
  const secureHintId = `${hintId}-secure`;
  const insecureContext = typeof window !== 'undefined' && window.isSecureContext === false;
  return <HStack gap="12" wrap="wrap" align="center" className={cls.action}>
    <Button variant="secondary" disabled={!ready || isFetching || isError} aria-describedby={insecureContext ? `${hintId} ${secureHintId}` : hintId} onClick={() => dispatch(aiChatActions.openWithSeed(seed))}>{t('autodial.workspace.askAi')}</Button>
    <Text variant="muted" id={hintId} className={ready ? cls.configuredHint : cls.hint}>{t(isFetching ? 'autodial.workspace.aiChecking' : isError ? 'autodial.common.loadFailed' : ready ? 'autodial.workspace.aiConfiguredHint' : capabilities?.ai ? 'autodial.workspace.aiNotConfigured' : 'autodial.workspace.aiUnknown')}</Text>
    {ready && insecureContext && <Text variant="muted" id={secureHintId}>{t('autodial.workspace.aiSecureContextHint')}</Text>}
    {(isError || !capabilities?.ai && !isFetching) && <Button variant="outline" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
    {capabilities?.ai?.configured === false && (level === 0 || level === 1) && <Link to="/ai-providers">{t('autodial.workspace.aiConnect')}</Link>}
  </HStack>;
}
