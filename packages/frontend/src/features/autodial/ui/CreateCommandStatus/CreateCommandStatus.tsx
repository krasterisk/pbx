import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';

export function CreateCommandStatus({ pending, busy, slow, onCheck }: {
  pending: boolean; busy: boolean; slow: boolean; onCheck: () => void;
}) {
  const { t } = useTranslation();
  if (!pending) return null;
  return <VStack gap="8" max align="stretch" role="status" aria-live="polite">
    <Text>{t(busy ? slow ? 'autodial.workspace.commandSlow' : 'autodial.workspace.commandSaving' : 'autodial.workspace.commandUncertain')}</Text>
    {!busy && <Button variant="outline" onClick={onCheck}>{t('autodial.workspace.commandCheck')}</Button>}
  </VStack>;
}
