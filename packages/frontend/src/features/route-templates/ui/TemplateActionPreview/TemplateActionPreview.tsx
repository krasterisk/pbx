import { useTranslation } from 'react-i18next';
import { parseTemplateSlotMarker, type IRouteAction, type ITemplateSlot } from '@krasterisk/shared';
import { Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { dialplanAppsRegistry } from '@/features/dialplan-apps/model/registry';
import { summarySlotLabels } from '@/features/dialplan-apps/model/summaryLabels';
import { sanitizeParamsForPreview } from '../../model/sanitizeParamsForPreview';
import styles from './TemplateActionPreview.module.scss';

export interface TemplateActionPreviewProps {
  actions: IRouteAction[];
  slots?: ITemplateSlot[];
}

function collectMarkers(value: unknown, acc: string[]): void {
  if (typeof value === 'string') {
    const id = parseTemplateSlotMarker(value);
    if (id) acc.push(id);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMarkers(item, acc));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => collectMarkers(child, acc));
  }
}

export function TemplateActionPreview({ actions, slots = [] }: TemplateActionPreviewProps) {
  const { t } = useTranslation();
  const templateSlotLabels = summarySlotLabels(slots, t);

  return (
    <VStack gap="8" className={styles.list} role="list">
      {actions.map((action, index) => {
        const config = action.type ? dialplanAppsRegistry[action.type] : undefined;
        const displayParams = sanitizeParamsForPreview(action.params ?? {}, slots);
        const summary = config?.summarize
          ? config.summarize(displayParams, t, { templateSlotLabels })
          : action.type || t('routes.selectAction', 'Выберите действие');
        const markers: string[] = [];
        collectMarkers(action.params, markers);
        return (
          <HStack key={action.id || `${action.type}-${index}`} gap="8" align="center" className={styles.row} role="listitem">
            <Text className={styles.index}>{index + 1}</Text>
            <VStack gap="4" max>
              <Text>{summary}</Text>
              {markers.length > 0 ? (
                <HStack gap="4" className={styles.chips}>
                  {markers.map((id) => (
                    <Text key={id} as="span" className={styles.chip}>
                      {templateSlotLabels[id] || t('routes.chain.summaryReference.templateSlot', 'Параметр шаблона')}
                    </Text>
                  ))}
                </HStack>
              ) : null}
            </VStack>
          </HStack>
        );
      })}
    </VStack>
  );
}
