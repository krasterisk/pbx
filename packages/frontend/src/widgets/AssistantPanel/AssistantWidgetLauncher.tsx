import { useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, LoaderCircle } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import type { ButtonProps } from '@/shared/ui/Button/Button';
import cls from './AssistantPanel.module.scss';

interface Props {
    style: CSSProperties;
    controls: Pick<ButtonProps, 'onPointerDown' | 'onKeyDown'>;
    busy: boolean;
    pendingCount: number;
    minimized: boolean;
    onActivate: (keyboard: boolean) => void;
}

export function AssistantWidgetLauncher({ style, controls, busy, pendingCount, minimized, onActivate }: Props) {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (minimized) buttonRef.current?.focus(); }, [minimized]);
    const label = t(minimized ? 'aiChat.restoreWidget' : 'aiChat.openWidget');
    return (
        <Button ref={buttonRef} className={`${cls.launcher} ${busy ? cls.launcherBusy : ''}`}
            style={style} onClick={(event) => onActivate(event.detail === 0)} {...controls}
            title={`${label}. ${t('aiChat.moveWidget')}`} aria-label={label}
            aria-haspopup="dialog" aria-expanded={false} data-testid="ai-agent-launcher">
            {busy ? <LoaderCircle size={24} className={cls.launcherSpinner} aria-hidden /> : <Bot size={24} aria-hidden />}
            {pendingCount > 0 && <Text as="span" className={cls.launcherBadge}>{pendingCount}</Text>}
            {busy && <Text as="span" className={cls.srOnly} role="status">{t('aiChat.progress.working')}</Text>}
        </Button>
    );
}
