import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Button, Text, VStack } from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import {
  useAgentWrapupDoneMutation,
  useAgentWrapupExtendMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './WrapupBar.module.scss';

export interface WrapupBarProps {
  remainingSec: number;
  totalSec: number;
  extendStep: number;
  onExtendSuccess?: (remainingSec: number) => void;
  onDoneSuccess?: () => void;
}

export function WrapupBar({
  remainingSec,
  totalSec,
  extendStep,
  onExtendSuccess,
  onDoneSuccess,
}: WrapupBarProps) {
  const { t } = useTranslation();
  const [extendWrapup, { isLoading: extending }] = useAgentWrapupExtendMutation();
  const [wrapupDone, { isLoading: finishing }] = useAgentWrapupDoneMutation();

  const progressValue = totalSec > 0 ? (remainingSec / totalSec) * 100 : 0;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleExtend = async () => {
    try {
      await extendWrapup({ seconds: extendStep }).unwrap();
      onExtendSuccess?.(remainingSec + extendStep);
    } catch {
      /* RTK surfaces errors elsewhere */
    }
  };

  const handleDone = async () => {
    try {
      await wrapupDone().unwrap();
      onDoneSuccess?.();
    } catch {
      /* ignore */
    }
  };

  return (
    <VStack gap="12" className={styles.wrapupBar}>
      <Clock className="w-12 h-12 opacity-50 text-[var(--color-info)]" />
      <Text variant="h3">{t('callcenter.wrapup.title', 'Wrap-up')}</Text>
      <Text variant="muted" className={styles.hint}>
        {t('callcenter.wrapup.hint', 'Fill in call notes before the next call')}
      </Text>
      <Text className={styles.timer}>{formatTime(remainingSec)}</Text>
      <Progress value={progressValue} tone="info" className={styles.progress} />
      <div className={styles.actions}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExtend}
          disabled={extending || finishing}
        >
          {t('callcenter.wrapup.extend', '+{{step}} sec', { step: extendStep })}
        </Button>
        <Button size="sm" onClick={handleDone} disabled={extending || finishing}>
          {t('callcenter.wrapup.done', 'Ready for next')}
        </Button>
      </div>
    </VStack>
  );
}
