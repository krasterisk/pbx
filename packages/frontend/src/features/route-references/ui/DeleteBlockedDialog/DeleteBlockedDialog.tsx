import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
  Tooltip,
} from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import type { RouteReference } from '@/shared/api/endpoints/routeReferencesApi';

export interface DeleteBlockedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  references: RouteReference[];
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteBlockedDialog({
  open,
  onOpenChange,
  entityName,
  references,
  onConfirm,
  isDeleting = false,
}: DeleteBlockedDialogProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const blocked = references.length > 0;
  const body = blocked
    ? t(
      references.length === 1 ? 'references.deleteBlockedBody_one' : 'references.deleteBlockedBody_other',
      references.length === 1
        ? 'На "{{name}}" ссылается 1 маршрут. Пока ссылка есть, удаление сломает этот маршрут'
        : 'На "{{name}}" ссылаются {{count}} маршрутов. Пока ссылки есть, удаление сломает эти маршруты',
      { name: entityName, count: references.length },
    )
    : t(
      'references.deleteConfirmEmpty',
      'Удалить "{{name}}": сущность нигде не используется. Продолжить?',
      { name: entityName },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="delete-blocked-dialog">
        <DialogHeader>
          <DialogTitle>
            {blocked
              ? t('references.deleteBlockedTitle', 'Сначала уберите ссылки')
              : t('common.confirmDelete', 'Удалить?')}
          </DialogTitle>
          <DialogDescription id={reasonId}>{body}</DialogDescription>
        </DialogHeader>

        {blocked && (
          <VStack gap="8" max data-testid="delete-blocked-references">
            {references.map((ref) => (
              <Text key={`${ref.routeUid}:${ref.actionOrBindingId}:${ref.location}`} variant="small">
                {ref.location}
              </Text>
            ))}
          </VStack>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Tooltip content={blocked ? body : undefined}>
            <span>
              <Button
                type="button"
                variant="destructive"
                disabled={blocked || isDeleting}
                aria-describedby={blocked ? reasonId : undefined}
                data-testid="delete-blocked-confirm"
                onClick={onConfirm}
              >
                {t('common.delete', 'Удалить')}
              </Button>
            </span>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
