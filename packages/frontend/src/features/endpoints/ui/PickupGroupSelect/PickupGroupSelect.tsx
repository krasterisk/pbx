import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X,  Trash2 } from 'lucide-react';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Button, Input } from '@/shared/ui';
import {
  useGetPickupGroupsQuery,
  useCreatePickupGroupMutation,
  useDeletePickupGroupMutation,
} from '@/shared/api/endpoints/pickupGroupApi';

interface PickupGroupSelectProps {
  label: string;
  selectedSlugs: string[]; // From DB: "group1,group2"
  onChange: (slugs: string[]) => void;
}

export const PickupGroupSelect = ({ label, selectedSlugs, onChange }: PickupGroupSelectProps) => {
  const { t } = useTranslation();
  const { data: groups = [], isLoading } = useGetPickupGroupsQuery();
  const [createGroup, { isLoading: isCreating }] = useCreatePickupGroupMutation();
  const [deleteGroup] = useDeletePickupGroupMutation();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const result = await createGroup({ name: newName.trim() }).unwrap();
      onChange([...selectedSlugs, result.slug]);
      setNewName('');
      setIsAdding(false);
    } catch (e: any) {
      alert(e.data?.message || 'Error creating group');
    }
  };

  const toggleGroup = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      onChange(selectedSlugs.filter(s => s !== slug));
    } else {
      onChange([...selectedSlugs, slug]);
    }
  };

  const currentSlugs = new Set(selectedSlugs);

  return (
    <VStack gap="8" className="border border-border/50 rounded-lg p-3 bg-white/[0.01]">
      <HStack justify="between" align="center" className="w-full">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        {!isAdding && (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </HStack>

      {isAdding && (
        <HStack gap="4" align="center" max>
          <Input 
             autoFocus
             value={newName} 
             onChange={e => setNewName(e.target.value)}
             placeholder={t('endpoints.groupName', 'Название группы')}
             className="h-8 text-xs"
             onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button size="icon" className="h-8 w-8 px-0 shrink-0" onClick={handleAdd} disabled={isCreating}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 px-0 shrink-0 text-muted-foreground" onClick={() => setIsAdding(false)}>
            <X className="w-4 h-4" />
          </Button>
        </HStack>
      )}

      {groups.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">
          {isLoading ? t('common.loading') : t('endpoints.noGroups', 'Нет созданных групп')}
        </span>
      ) : (
        <div className="flex flex-wrap gap-2 mt-1">
          {groups.map(g => {
            const isSelected = currentSlugs.has(g.slug);
            return (
              <HStack 
                key={g.uid} 
                className={`group px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer border ${
                  isSelected 
                    ? 'bg-primary/20 text-primary border-primary/50' 
                    : 'bg-background hover:bg-accent border-border text-muted-foreground'
                }`}
                gap="4" align="center"
              >
                <span onClick={() => toggleGroup(g.slug)} className="flex-1">{g.name}</span>
                <Trash2 
                  className="w-3 h-3 opacity-0 group-hover:opacity-50 hover:opacity-100! hover:text-destructive transition-opacity" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete group globally?')) {
                      // Also remove from local selection to prevent orphaned slugs
                      if (isSelected) toggleGroup(g.slug);
                      deleteGroup(g.uid);
                    }
                  }}
                />
              </HStack>
            );
          })}
        </div>
      )}
    </VStack>
  );
};
