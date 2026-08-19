import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Input, Text } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { DialplanAppsEditor, allowedTypesForHost } from '@/features/dialplan-apps';
import { IIvrMenuItem } from '@/entities/ivr';
import cls from './IvrMenuItemsEditor.module.scss';

interface IvrMenuItemsEditorProps {
  menuItems: IIvrMenuItem[];
  onChange: (items: IIvrMenuItem[]) => void;
}

export const IvrMenuItemsEditor = memo(({ menuItems, onChange }: IvrMenuItemsEditorProps) => {
  const { t } = useTranslation();
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
    if (expandedIndex === index) setExpandedIndex(null);
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
    <div className={cls.sectionPanel}>
      <Flex justify="between" align="center" className={cls.headerRow}>
        <Text variant="small" className={cls.sectionTitle}>
          {t('ivrs.menuItems.title', 'Пункты меню (DTMF Возможные сочетания)')}
        </Text>
        <Button onClick={handleAdd} size="sm" variant="outline">
          <Plus size={16} />
          {t('ivrs.menuItems.add', 'Добавить пункт')}
        </Button>
      </Flex>

      <VStack gap="8" max>
        {menuItems.map((item, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div key={idx} className={cls.itemCard}>
              <HStack justify="between" align="center" className={cls.itemHeader} max>
                <HStack gap="16" align="center" max>
                  <Text as="span" className={cls.digitLabel}>
                    {t('ivrs.menuItems.digitLabel', 'Нажатие / Паттерн:')}
                  </Text>
                  <Input
                    className={cls.digitInput}
                    placeholder="Например: 1, 2, t, i"
                    value={item.digit}
                    onChange={(e) => updateDigit(idx, e.target.value)}
                  />
                  <Text as="span" variant="xs" className={cls.actionsHint}>
                    {item.actions.length} {t('ivrs.menuItems.actionsCount', 'действий')}
                  </Text>
                </HStack>

                <HStack gap="4">
                  <Button variant="ghost" size="icon" onClick={() => toggleExpand(idx)}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(idx)}>
                    <Trash2 size={16} className={cls.deleteIcon} />
                  </Button>
                </HStack>
              </HStack>

              {isExpanded && (
                <div className={cls.itemBody}>
                  <DialplanAppsEditor
                    host="ivr"
                    labels={{ namespace: 'ivrs.menuItems' }}
                    allowedTypes={allowedTypesForHost('ivr')}
                    actions={item.actions}
                    onChange={(newActions) => updateActions(idx, newActions)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {menuItems.length === 0 && (
          <Text variant="small" className={cls.emptyState}>
            {t(
              'ivrs.menuItems.empty',
              'Нет пунктов меню. Нажмите «Добавить пункт», чтобы создать маршрут.',
            )}
          </Text>
        )}
      </VStack>
    </div>
  );
});

IvrMenuItemsEditor.displayName = 'IvrMenuItemsEditor';
