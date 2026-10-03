import type { PointerEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, X, Trash2, Maximize2, Minimize2, ClipboardList, Grip, Minus, History } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import type { ButtonProps } from '@/shared/ui/Button/Button';
import { HStack, VStack } from '@/shared/ui/Stack';
import cls from './AssistantPanel.module.scss';

interface Props {
    sheet: boolean;
    isDock: boolean;
    isStreaming: boolean;
    effectiveMode: 'dock' | 'workspace';
    plansOpen: boolean;
    pendingPlanCount: number;
    showThreadsToggle: boolean;
    threadsOpen: boolean;
    onToggleThreads: () => void;
    moveControls: Pick<ButtonProps, 'onKeyDown'> & { onPointerDown: PointerEventHandler<HTMLElement> };
    onTogglePlans: () => void;
    onClear: () => void;
    onToggleMode: () => void;
    onMinimize: () => void;
    onClose: () => void;
}

export function AssistantPanelHeader({ sheet, isDock, isStreaming, effectiveMode, plansOpen, pendingPlanCount,
    showThreadsToggle, threadsOpen, onToggleThreads, moveControls, onTogglePlans, onClear, onToggleMode, onMinimize, onClose }: Props) {
    const { t } = useTranslation();
    return (
        <HStack
            className={`${cls.header} ${!sheet && isDock ? cls.headerMovable : ''}`}
            gap="8"
            align="center"
            data-testid="ai-agent-header"
            onPointerDown={(event) => {
                if (sheet || !isDock || (event.target as Element).closest('button')) return;
                moveControls.onPointerDown(event);
            }}
        >
            {!sheet && isDock && (
                <Button variant="ghost" size="icon" className={cls.moveHandle}
                    title={t('aiChat.moveWidget')} aria-label={t('aiChat.moveWidget')}
                    data-testid="ai-agent-move" {...moveControls}>
                    <Grip size={16} aria-hidden />
                </Button>
            )}
            <VStack className={cls.avatar} align="center" justify="center">
                <Bot size={18} aria-hidden />
            </VStack>
            <VStack className={cls.headerInfo} gap="0" align="start">
                <Text as="span" className={cls.headerTitle}>{t('aiChat.title')}</Text>
                <Text
                    as="span"
                    className={`${cls.headerStatus} ${isStreaming ? cls.headerStatusBusy : ''}`}
                    data-testid="ai-agent-header-status"
                >
                    {isStreaming ? t('aiChat.progress.working') : t('aiChat.ready')}
                </Text>
            </VStack>

            {showThreadsToggle && (
                <Button variant="ghost" size="icon" onClick={onToggleThreads}
                    title={t('aiChat.threadsHeading')} aria-label={t('aiChat.threadsHeading')}
                    aria-expanded={threadsOpen} aria-controls="ai-agent-thread-overlay">
                    <History size={16} aria-hidden />
                </Button>
            )}
            <Button
                variant="ghost"
                size="icon"
                className={`${cls.planToggle} ${plansOpen ? cls.planToggleActive : ''}`}
                onClick={onTogglePlans}
                title={plansOpen
                    ? (isDock ? t('aiChat.backToChat') : t('aiChat.hidePlans'))
                    : t('aiChat.openPlans')}
                aria-label={t('aiChat.openPlans')}
                aria-expanded={plansOpen}
                aria-pressed={plansOpen}
                aria-controls={isDock ? 'ai-agent-plan-overlay' : 'ai-agent-plan-column'}
                data-active={plansOpen ? 'true' : 'false'}
            >
                <ClipboardList size={16} aria-hidden />
                {pendingPlanCount > 0 && (
                    <Text as="span" className={cls.planBadge}>{pendingPlanCount}</Text>
                )}
            </Button>

            <Button
                variant="ghost"
                size="icon"
                onClick={onClear}
                title={t('aiChat.clearChat')}
                aria-label={t('aiChat.clearChat')}
            >
                <Trash2 size={14} />
            </Button>

            {!sheet && <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMode}
                title={effectiveMode === 'workspace' ? t('aiChat.collapse') : t('aiChat.expand')}
                aria-label={effectiveMode === 'workspace' ? t('aiChat.collapse') : t('aiChat.expand')}
            >
                {effectiveMode === 'workspace' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>}

            <Button variant="ghost" size="icon" onClick={onMinimize}
                title={t('aiChat.minimizeWidget')} aria-label={t('aiChat.minimizeWidget')}>
                <Minus size={16} aria-hidden />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                title={t('aiChat.closePanel')}
                aria-label={t('aiChat.closePanel')}
            >
                <X size={16} />
            </Button>
        </HStack>

    );
}
