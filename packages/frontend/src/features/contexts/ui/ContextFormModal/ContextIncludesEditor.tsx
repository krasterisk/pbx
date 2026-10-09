import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { InfoTooltip, Label, MultiSelect, SortableList, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import type { IContext } from '@/shared/api/api';

export const ContextIncludesEditor = ({ value, onChange, contexts, contextUid, onValidityChange }: {
  value: number[]; onChange: (uids: number[]) => void; contexts: IContext[]; contextUid?: number;
  onValidityChange?: (valid: boolean) => void;
}) => {
  const { t } = useTranslation();
  const catalog = new Map(contexts.map((context) => [context.uid, context]));
  const seen = new Set<number>();
  const active = new Set(contextUid ? [contextUid] : []);
  const effective: string[] = [];
  let cycle = false;
  const visit = (uid: number) => {
    if (active.has(uid)) { cycle = true; return; }
    if (seen.has(uid)) return;
    seen.add(uid);
    active.add(uid);
    const context = catalog.get(uid);
    effective.push(context?.name ?? String(uid));
    for (const target of context?.include_uids ?? []) visit(target);
    active.delete(uid);
  };
  value.forEach(visit);
  useEffect(() => { onValidityChange?.(!cycle); }, [cycle, onValidityChange]);
  return (
    <VStack gap="8" max>
      <HStack gap="8"><Label>{t('contexts.includes')}</Label>
        <InfoTooltip text={[t('contexts.includesHint'), effective.length > 0 ? t('contexts.effectiveIncludes', { names: effective.join(' → ') }) : ''].filter(Boolean).join('\n\n')} />
      </HStack>
      <MultiSelect value={value.map(String)} onChange={(ids) => onChange(ids.map(Number))}
        options={contexts.filter((context) => context.uid !== contextUid).map((context) => ({ value: String(context.uid), label: context.name, description: context.comment }))}
        placeholder={t('contexts.selectIncludes')} searchable searchPlaceholder={t('contexts.searchIncludes')} />

      <SortableList items={value.map((uid) => ({ id: String(uid), label: catalog.get(uid)?.name ?? String(uid), content: <Text>{catalog.get(uid)?.name ?? String(uid)}</Text> }))}
        onReorder={(ids) => onChange(ids.map(Number))} moveUpLabel={t('contexts.moveUp')} moveDownLabel={t('contexts.moveDown')} dragLabel={t('contexts.dragInclude')} />

      {cycle && <Text variant="error" role="alert">{t('contexts.includeCycle')}</Text>}
    </VStack>
  );
};
