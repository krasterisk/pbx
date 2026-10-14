import { memo, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronRight, ListTree } from 'lucide-react';
import { Button, Input, Label, Text, Tooltip, ModalSection, VStack, HStack } from '@/shared/ui';
import { DialplanAppsEditor, allowedTypesForHost } from '@/features/dialplan-apps';
import type { IIvrMenuItem } from '@/entities/ivr';
import cls from './IvrMenuItemsEditor.module.scss';

interface IvrMenuItemsEditorProps {
  menuItems: IIvrMenuItem[];
  onChange: (items: IIvrMenuItem[]) => void;
}

export const IvrMenuItemsEditor = memo(({ menuItems, onChange }: IvrMenuItemsEditorProps) => {
  const { t } = useTranslation();
  const editorId = useId();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleAdd = () => {
    onChange([
      ...menuItems,
      {
        digit: '',
        actions: [],
      },
    ]);
    setExpandedIndex(menuItems.length);
  };

  const handleRemove = (index: number) => {
    const updated = [...menuItems];
    updated.splice(index, 1);
    onChange(updated);
    setExpandedIndex((previous) =>
      previous === index ? null : previous != null && previous > index ? previous - 1 : previous,
    );
  };

  const updateDigit = (index: number, digit: string) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], digit };
    onChange(updated);
  };

  const updateActions = (index: number, actions: IIvrMenuItem['actions']) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], actions };
    onChange(updated);
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <ModalSection
      title={t('ivrs.menuItems.title')}
      icon={ListTree}
      action={
        <Button type="button" onClick={handleAdd} size="sm" variant="outline">
          <Plus size={16} aria-hidden />
          {t('ivrs.menuItems.add')}
        </Button>
      }
    >
      <VStack align="stretch" gap="12" max>
        {menuItems.map((item, idx) => {
          const isExpanded = expandedIndex === idx;
          const title = item.digit || t('ivrs.editor.newItem');
          const panelId = editorId + '-' + idx;
          return (
            <VStack key={idx} align="stretch" max className={cls.itemCard}>
              <HStack align="center" gap="8" max className={cls.itemHeader}>
                <Button
                  type="button"
                  variant="ghost"
                  className={cls.toggle}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => toggleExpand(idx)}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} aria-hidden />
                  ) : (
                    <ChevronRight size={16} aria-hidden />
                  )}
                  <Text as="span" className={cls.itemTitle}>
                    {title}
                  </Text>
                  <Text as="span" variant="muted" className={cls.actionsHint}>
                    {item.actions.length} {t('ivrs.menuItems.actionsCount')}
                  </Text>
                </Button>
                <Tooltip content={t('common.delete')}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cls.deleteButton}
                    aria-label={t('common.delete') + ': ' + title}
                    onClick={() => handleRemove(idx)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </Button>
                </Tooltip>
              </HStack>
              {isExpanded && (
                <VStack id={panelId} align="stretch" gap="16" max className={cls.itemBody}>
                  <VStack align="stretch" gap="4" max>
                    <Label htmlFor={panelId + '-digit'}>{t('ivrs.menuItems.digitLabel')}</Label>
                    <Input
                      id={panelId + '-digit'}
                      placeholder={t('ivrs.editor.digitPlaceholder')}
                      value={item.digit}
                      onChange={(event) => updateDigit(idx, event.target.value)}
                    />
                  </VStack>
                  <DialplanAppsEditor
                    host="ivr"
                    labels={{ namespace: 'ivrs.menuItems' }}
                    allowedTypes={allowedTypesForHost('ivr')}
                    actions={item.actions}
                    onChange={(actions) => updateActions(idx, actions)}
                  />
                </VStack>
              )}
            </VStack>
          );
        })}
        {menuItems.length === 0 && (
          <Text variant="muted" className={cls.emptyState}>
            {t('ivrs.menuItems.empty')}
          </Text>
        )}
      </VStack>
    </ModalSection>
  );
});

IvrMenuItemsEditor.displayName = 'IvrMenuItemsEditor';
