import { memo } from 'react';
import { IvrsTable } from '@/features/ivrs';
import { VStack, HStack } from '@/shared/ui/Stack';
import { GitMerge } from 'lucide-react';

export const IvrsPage = memo(() => {
  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <HStack gap="12" align="center">
          <GitMerge className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">IVR Меню</h1>
        </HStack>
      </HStack>
      <div className="w-full h-full animate-fade-in">
        <IvrsTable />
      </div>
    </VStack>
  );
});

IvrsPage.displayName = 'IvrsPage';
