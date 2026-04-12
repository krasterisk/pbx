import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Input, VStack, HStack } from '@/shared/ui';
import { ActionsTableEditor } from '@/features/routes/ui/ActionsTableEditor/ActionsTableEditor';
import { IIvrMenuItem } from '@/entities/ivr';
import { useState } from 'react';

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

  const updateActions = (index: number, actions: any[]) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], actions };
    onChange(updated);
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <VStack gap={4} className="w-full">
      <div className="flex justify-between items-center w-full">
        <Typography variant="h6" className="text-sm font-medium text-slate-300">
          {t('ivrs.menuItems.title', 'Пункты меню (DTMF Возможные сочетания)')}
        </Typography>
        <Button onClick={handleAdd} size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-1" />
          {t('ivrs.menuItems.add', 'Добавить пункт')}
        </Button>
      </div>

      <VStack gap={2} className="w-full">
        {menuItems.map((item, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div key={idx} className="w-full border border-[#27272a] rounded overflow-hidden">
              <HStack gap={4} className="bg-[#18181b] p-3 items-center justify-between w-full">
                <HStack gap={4} className="flex-1 items-center">
                  <span className="text-slate-400 font-medium w-32 text-sm">
                    {t('ivrs.menuItems.digitLabel', 'Нажатие / Паттерн:')}
                  </span>
                  <Input
                    className="w-40 bg-[#09090b]"
                    placeholder="Например: 1, 2, t, i"
                    value={item.digit}
                    onChange={(e) => updateDigit(idx, e.target.value)}
                  />
                  <span className="text-slate-500 text-xs ml-2">
                    {item.actions.length} {t('ivrs.menuItems.actionsCount', 'действий')}
                  </span>
                </HStack>

                <HStack gap={2} className="items-center">
                  <Button variant="ghost" size="icon" onClick={() => toggleExpand(idx)}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(idx)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </HStack>
              </HStack>

              {isExpanded && (
                <div className="p-4 bg-[#0c1214] border-t border-[#27272a]">
                  <ActionsTableEditor
                    actions={item.actions}
                    onChange={(newActions) => updateActions(idx, newActions)}
                  />
                </div>
              )}
            </div>
          );
        })}
        {menuItems.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-sm">
            {t('ivrs.menuItems.empty', 'Нет пунктов меню. Нажмите "Добавить пункт" чтобы создать маршрут.')}
          </div>
        )}
      </VStack>
    </VStack>
  );
});

IvrMenuItemsEditor.displayName = 'IvrMenuItemsEditor';

// Mock Typography since it might be missing in some imports
function Typography({ children, className }: any) {
  return <div className={className}>{children}</div>;
}
