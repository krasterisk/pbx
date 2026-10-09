import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { VStack } from '../Stack';
import { Text } from '../Text/Text';
import { Button } from '../Button';
import { classNames } from '@/shared/lib/classNames/classNames';
import cls from './QueryErrorState.module.scss';

export interface QueryErrorStateProps {
  message?: ReactNode;
  onRetry?: () => unknown;
  retryLabel?: string;
  className?: string;
  'data-testid'?: string;
}

/** Centered placeholder for a failed page, table or content-section query. */
export function QueryErrorState({ message, onRetry, retryLabel, className, ...props }: QueryErrorStateProps) {
  const { t } = useTranslation();
  const label = retryLabel ?? t('common.retry');
  return (
    <VStack max align="center" justify="center" gap="16" className={classNames(cls.root, {}, [className])} {...props}>
      <Text align="center" role="alert" className={cls.message}>{message ?? t('common.queryLoadError')}</Text>
      {onRetry && <Button type="button" variant="outline" aria-label={label} onClick={() => void onRetry()}>{label}</Button>}
    </VStack>
  );
}
