import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Pencil, Trash2, Columns2, Square } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Badge, Text, Tooltip } from '@/shared/ui';
import { Flex } from '@/shared/ui/Stack';
import type { ICardField } from '@/features/callcenter/model/types/callCard';

export type BuilderField = ICardField & { id: string };

export interface FieldRowProps {
  field: BuilderField;
  selected: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onToggleWidth: () => void;
}

export const FieldRow = memo(({ field, selected, onEdit, onRemove, onToggleWidth }: FieldRowProps) => {
  const { t } = useTranslation();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const handleRemove = useCallback(() => onRemove(), [onRemove]);

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      direction="row"
      align="center"
      gap="8"
      className={`p-3 border rounded-lg bg-background/50 ${isDragging ? 'border-primary' : 'border-border'} ${selected ? 'ring-1 ring-primary' : ''}`}
    >
      <Tooltip content={t('callcenter.cards.builder.dragHandle')}>
        <Flex
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </Flex>
      </Tooltip>

      <Flex direction="column" gap="2" className="flex-1 min-w-0">
        <Text className="truncate font-medium">{field.label || field.field_key}</Text>
        <Flex gap="6" align="center">
          <Badge variant="secondary">{t(`callcenter.cards.fieldTypes.${field.field_type}`)}</Badge>
          {field.is_required ? (
            <Text variant="muted" className="text-xs">{t('callcenter.cards.builder.required')}</Text>
          ) : null}
        </Flex>
      </Flex>

      <Tooltip content={field.width === 'half' ? t('callcenter.cards.builder.widthFull') : t('callcenter.cards.builder.widthHalf')}>
        <Button variant="ghost" size="icon" onClick={onToggleWidth}>
          {field.width === 'half' ? <Columns2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </Button>
      </Tooltip>

      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="w-4 h-4" />
      </Button>

      <Tooltip content={t('common.delete')}>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
          onClick={handleRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </Tooltip>
    </Flex>
  );
});

FieldRow.displayName = 'FieldRow';
