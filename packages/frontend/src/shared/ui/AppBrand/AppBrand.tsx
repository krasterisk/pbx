import { Flex } from '../Stack';
import { Text } from '../Text';
import { cn } from '@/shared/lib/utils';
import cls from './AppBrand.module.scss';

export function AppBrand({ compact = false, className, id }: { compact?: boolean; className?: string; id?: string }) {
  return <Flex id={id} className={cn(cls.brand, className)} data-compact={compact ? 'true' : 'false'}>
    <img src='/brand/aipbx-logo.png?v=2' alt={compact ? 'AI PBX Krasterisk' : ''} width={32} height={32} className={cls.logo} />
    {!compact && <Text as='span' className={cls.name}>AI PBX Krasterisk</Text>}
  </Flex>;
}
