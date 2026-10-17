import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import type { AutodialLiveChannel } from '../../lib/autodialLiveState';
import { formatAutodialDuration } from '../../lib/labels';
import cls from './MonitorBoard.module.scss';

export function CallLanes({ channels, now }: { channels: AutodialLiveChannel[]; now: number }) {
  const { t } = useTranslation();
  return <div className={cls.callLanes} role="list" aria-label={t('autodial.workspace.callLanes')}>
    {channels.map((channel) => {
      const total = Math.max(1, now - channel.startedAt);
      const ringing = Math.max(0, (channel.answeredAt ?? now) - channel.startedAt);
      const talking = channel.answeredAt == null ? 0 : Math.max(0, now - channel.answeredAt);
      const ringLabel = `${t('autodial.monitor.ringingState')}: ${formatAutodialDuration(ringing / 1000)}`;
      const talkLabel = `${t('autodial.monitor.talkingState')}: ${formatAutodialDuration(talking / 1000)}`;
      return <div key={channel.channelId} role="listitem" className={cls.callLane}>
        <Text>{channel.customerName || channel.number} · {channel.number}</Text>
        <div className={cls.callTimeline} role="img" aria-label={`${ringLabel}; ${talkLabel}`}>
          <span className={cls.ringingSegment} style={{ width: `${Math.min(100, ringing / total * 100)}%` }} title={ringLabel} />
          {talking > 0 && <span className={cls.talkingSegment} style={{ width: `${Math.min(100, talking / total * 100)}%` }} title={talkLabel} />}
        </div>
        <Text variant="muted">{ringLabel} · {talkLabel}{channel.stepType ? ` · ${t(`routes.action.${channel.stepType}`, channel.stepType)}` : ''}</Text>
      </div>;
    })}
  </div>;
}
