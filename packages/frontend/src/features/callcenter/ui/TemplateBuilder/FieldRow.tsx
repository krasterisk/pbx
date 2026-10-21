import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Pencil, Trash2, Columns2, Square, ArrowUp, ArrowDown } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge, Text, Tooltip, TableRowAction } from '@/shared/ui';
import { Flex } from '@/shared/ui/Stack';
import styles from './FieldRow.module.scss';
import type { ICardField } from '@/features/callcenter/model/types/callCard';

export type BuilderField = ICardField & { id: string };

export interface FieldRowProps {
  field: BuilderField;
  selected: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onToggleWidth: () => void;
  onMove?: (delta: number) => void;
  first?: boolean;
  last?: boolean;
}

export const FieldRow = memo(({ field, selected, onEdit, onRemove, onToggleWidth, onMove, first, last }: FieldRowProps) => {
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
  };

  const handleRemove = useCallback(() => onRemove(), [onRemove]);

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      direction="row"
      align="center"
      gap="8"
      className={`${styles.row}${isDragging ? ` ${styles.dragging}` : ''}${selected ? ` ${styles.selected}` : ''}`}
    >
      <Tooltip content={t('callcenter.cards.builder.dragHandle')}>
        <Flex
          {...attributes}
          aria-label={t('callcenter.cards.builder.dragHandle')}
          {...listeners}
          className={styles.handle}
        >
          <GripVertical size={16} />
        </Flex>
      </Tooltip>

      <Flex direction="column" gap="2" className={styles.body}>
        <Text className={styles.label}>{field.label || field.field_key}</Text>
        <Flex gap="6" align="center">
          <Badge variant="secondary">{t(`callcenter.cards.fieldTypes.${field.field_type}`)}</Badge>
          {field.is_required ? (
            <Text variant="muted" className={styles.required}>{t('callcenter.cards.builder.required')}</Text>
          ) : null}
        </Flex>
      </Flex>

      {onMove ? (
        <>
          <TableRowAction disabled={first} aria-label={t('callcenter.cards.builder.moveUp')} onClick={() => onMove(-1)}><ArrowUp size={16} /></TableRowAction>
          <TableRowAction disabled={last} aria-label={t('callcenter.cards.builder.moveDown')} onClick={() => onMove(1)}><ArrowDown size={16} /></TableRowAction>
        </>
      ) : null}
      <TableRowAction aria-label={t(field.width === 'half' ? 'callcenter.cards.builder.widthFull' : 'callcenter.cards.builder.widthHalf')} onClick={onToggleWidth}>
        {field.width === 'half' ? <Columns2 size={16} /> : <Square size={16} />}
      </TableRowAction>
      <TableRowAction aria-label={t('common.edit')} onClick={onEdit}>
        <Pencil size={16} />
      </TableRowAction>
      <TableRowAction danger aria-label={t('common.delete')} onClick={handleRemove}>
        <Trash2 size={16} />
      </TableRowAction>
    </Flex>
  );
});

FieldRow.displayName = 'FieldRow';
