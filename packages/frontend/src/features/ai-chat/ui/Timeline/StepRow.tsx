import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, ChevronDown, Loader } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import type { AgentTimelineStepItem } from '@krasterisk/shared';
import { resolveAgentToolLabel } from '../../model/agentToolLabels';
import cls from './TimelineList.module.scss';

interface StepRowProps {
    item: AgentTimelineStepItem;
}

export const StepRow = ({ item }: StepRowProps) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(Boolean(!item.done && (item.detailKey || item.detailFallback)));
    const statusKey = item.done ? 'aiChat.timeline.stepDone' : 'aiChat.timeline.stepPending';
    const label = resolveAgentToolLabel(t, item);
    const detail = item.detailKey
        ? t(item.detailKey, item.detailFallback)
        : item.detailFallback;
    const hasDetail = Boolean(detail);

    return (
        <VStack
            className={`${cls.item} ${cls.step} ${item.done ? cls.stepDone : ''}`}
            data-kind="step"
            data-testid="ai-agent-step"
            data-open={open ? 'true' : 'false'}
            align="stretch"
        >
            {hasDetail ? (
                <Button
                    type="button"
                    variant="ghost"
                    className={cls.stepToggle}
                    aria-expanded={open}
                    aria-label={t(statusKey)}
                    onClick={() => setOpen((prev) => !prev)}
                >
                    <HStack gap="8" align="center">
                        {item.done
                            ? <CheckCircle size={13} aria-hidden />
                            : <Loader size={13} className={cls.spinIcon} aria-hidden />}
                        <Text as="span" className={cls.stepLabel} data-testid="ai-agent-step-label">{label}</Text>
                        <ChevronDown size={14} className={`${cls.stepChevron} ${open ? cls.stepChevronOpen : ''}`} aria-hidden />
                    </HStack>
                </Button>
            ) : (
                <HStack className={cls.stepToggle} gap="8" align="center" aria-label={t(statusKey)}>
                    {item.done
                        ? <CheckCircle size={13} aria-hidden />
                        : <Loader size={13} className={cls.spinIcon} aria-hidden />}
                    <Text as="span" className={cls.stepLabel} data-testid="ai-agent-step-label">{label}</Text>
                </HStack>
            )}
            {hasDetail && open && (
                <Text as="p" className={cls.stepDetail} data-testid="ai-agent-step-detail">
                    {detail}
                </Text>
            )}
        </VStack>
    );
};
