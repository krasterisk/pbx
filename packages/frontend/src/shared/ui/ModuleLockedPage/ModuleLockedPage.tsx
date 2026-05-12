import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Store, ArrowLeft } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import cls from './ModuleLockedPage.module.scss';

interface ModuleLockedPageProps {
  moduleName?: string;
  moduleCode?: string;
  description?: string;
}

/**
 * ModuleLockedPage — заглушка для разделов, требующих неактивного модуля.
 * Показывает кнопку "Перейти в Marketplace" и объяснение.
 */
export const ModuleLockedPage = memo(({
  moduleName = 'Этот раздел',
  moduleCode,
  description,
}: ModuleLockedPageProps) => {
  const navigate = useNavigate();

  return (
    <div className={cls.wrapper}>
      <VStack gap="32" align="center" className={cls.content}>
        {/* Icon */}
        <div className={cls.iconWrap}>
          <Lock className={cls.lockIcon} />
        </div>

        {/* Text */}
        <VStack gap="12" align="center">
          <Text variant="h1" className={cls.title}>
            {moduleName} недоступен
          </Text>
          <Text variant="muted" className={cls.subtitle}>
            {description ?? 'Для доступа к этому разделу необходимо подключить соответствующий модуль в Marketplace.'}
          </Text>
          {moduleCode && (
            <span className={cls.codeBadge}>
              {moduleCode}
            </span>
          )}
        </VStack>

        {/* Actions */}
        <HStack gap="12">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            id="module-locked-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <Button
            onClick={() => navigate('/marketplace')}
            id="module-locked-marketplace-btn"
          >
            <Store className="w-4 h-4 mr-2" />
            Перейти в Marketplace
          </Button>
        </HStack>
      </VStack>
    </div>
  );
});

ModuleLockedPage.displayName = 'ModuleLockedPage';
