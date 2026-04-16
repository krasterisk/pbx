import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { ADVANCED_PJSIP_FIELDS } from '../../config/pjsipAdvancedFields';

export interface AdvancedSettingsBuilderProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  excludeFields?: string[];
  /** Optional custom field list. Defaults to ADVANCED_PJSIP_FIELDS if not provided. */
  fields?: string[];
  /** Override the header title */
  title?: string;
  /** Override the header description */
  description?: string;
}

export const AdvancedSettingsBuilder = memo(({ value, onChange, excludeFields, fields, title, description }: AdvancedSettingsBuilderProps) => {
  const { t } = useTranslation();

  // Internal state as Array to allow easy key editing and ordering
  const [items, setItems] = useState<{ id: number; key: string; val: string }[]>(() => {
    return Object.entries(value || {}).map(([k, v], idx) => ({ id: Date.now() + idx, key: k, val: String(v) }));
  });

  // Sync incoming value down if it completely changed (e.g. modal opened with new data)
  useEffect(() => {
    // Basic check if length differs to avoid heavy deep compares
    if (Object.keys(value || {}).length !== items.length) {
      setItems(Object.entries(value || {}).map(([k, v], idx) => ({ id: Date.now() + idx, key: k, val: String(v) })));
    }
  }, [value]);

  const notifyChange = (newItems: typeof items) => {
    const newVal: Record<string, any> = {};
    newItems.forEach((i) => {
      if (i.key.trim()) {
        newVal[i.key.trim()] = i.val;
      }
    });
    onChange(newVal);
  };

  const addItem = () => {
    const newItems = [...items, { id: Date.now(), key: '', val: '' }];
    setItems(newItems);
  };

  const removeItem = (idToRemove: number) => {
    const newItems = items.filter((i) => i.id !== idToRemove);
    setItems(newItems);
    notifyChange(newItems);
  };

  const updateItemKey = (id: number, newKey: string) => {
    const newItems = items.map((i) => (i.id === id ? { ...i, key: newKey } : i));
    setItems(newItems);
    notifyChange(newItems);
  };

  const updateItemVal = (id: number, newVal: string) => {
    const newItems = items.map((i) => (i.id === id ? { ...i, val: newVal } : i));
    setItems(newItems);
    notifyChange(newItems);
  };

  // Get options sorted and filter out already selected keys
  const selectedKeys = items.map((i) => i.key).filter(Boolean);
  const fieldList = fields || ADVANCED_PJSIP_FIELDS;
  const availableOptions = fieldList.filter((k) => !selectedKeys.includes(k) && (!excludeFields || !excludeFields.includes(k))).sort();

  return (
    <VStack gap="16">
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-2">
        <h4 className="text-sm font-semibold text-primary mb-1">
          {title || t('endpoints.advancedBuilderTitle')}
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description || t('endpoints.advancedBuilderDesc')}
        </p>
      </div>

      <VStack gap="12">
        {items.map((item) => (
          <HStack key={item.id} gap="8" align="center">
            <div className="flex-1">
              <select
                value={item.key || ''}
                onChange={(e) => updateItemKey(item.id, e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              >
                <option value="" disabled>
                  {t('endpoints.selectParameter')}
                </option>
                {item.key && (
                  <option value={item.key} className="font-mono bg-accent/30">
                    {item.key}
                  </option>
                )}
                {availableOptions.map((opt) => (
                  <option key={opt} value={opt} className="font-mono">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Input
                placeholder={t('endpoints.parameterValue')}
                value={item.val}
                onChange={(e) => updateItemVal(item.id, e.target.value)}
                className="font-mono h-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive border-transparent hover:border-destructive/30 hover:bg-destructive/10"
              onClick={() => removeItem(item.id)}
              title={t('endpoints.removeParameter')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </HStack>
        ))}
      </VStack>

      {availableOptions.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="self-start gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
          onClick={addItem}
        >
          <Plus className="w-4 h-4" />
          {t('endpoints.addParameter')}
        </Button>
      )}
    </VStack>
  );
});

AdvancedSettingsBuilder.displayName = 'AdvancedSettingsBuilder';
