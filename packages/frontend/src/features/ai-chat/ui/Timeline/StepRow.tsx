import { useTranslation } from 'react-i18next';
import { CheckCircle, Loader } from 'lucide-react';
import { Text } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import type { AgentTimelineStepItem } from '@krasterisk/shared';
import cls from './TimelineList.module.scss';

interface StepRowProps {
    item: AgentTimelineStepItem;
}

export const StepRow = ({ item }: StepRowProps) => {
    const { t } = useTranslation();
    const statusKey = item.done ? 'aiChat.timeline.stepDone' : 'aiChat.timeline.stepPending';

    return (
        <HStack
            className={`${cls.item} ${cls.step} ${item.done ? cls.stepDone : ''}`}
            data-kind="step"
            data-testid="ai-agent-step"
            gap="8"
            align="center"
            aria-label={t(statusKey)}
        >
            {item.done
                ? <CheckCircle size={13} aria-hidden />
                : <Loader size={13} className={cls.spinIcon} aria-hidden />}
            <Text as="span" className={cls.stepLabel}>
                {t(item.labelKey, item.labelFallback)}
            </Text>
        </HStack>
    );
};
