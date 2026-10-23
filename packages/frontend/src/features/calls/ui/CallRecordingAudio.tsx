import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CallRecording } from '@krasterisk/shared';
import { useGetCdrRecordingQuery } from '@/shared/api/endpoints/cdrApi';
import { getAuthApiBase } from '@/shared/api/apiBase';
import { Select, Text, VStack, QueryErrorState } from '@/shared/ui';
import cls from './Calls.module.scss';
import { MediaAudio } from '@/shared/ui/MediaAudio/MediaAudio';
export function CallAudio({
  recording,
  callId,
  startMs,
  autoPlay = false,
}: {
  recording: CallRecording;
  callId: string;
  startMs?: number;
  autoPlay?: boolean;
}) {
  const { t } = useTranslation();
  const audio = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState('1');
  const [failed, setFailed] = useState(false);
  const appliedTarget = useRef('');
  const { data, isLoading, isError, refetch } = useGetCdrRecordingQuery(
    recording.id,
  );
  const applyTarget = useCallback((media: HTMLAudioElement | null) => {
    if (startMs === undefined) { appliedTarget.current=''; return; }
    if (!media || media.readyState < 1 || !Number.isFinite(startMs) || startMs < 0 || !Number.isFinite(media.duration) || startMs / 1000 > media.duration) return;
    const key = `${callId}:${recording.id}:${startMs}:${media.currentSrc}`;
    if (appliedTarget.current === key) return;
    media.currentTime = startMs / 1000;
    appliedTarget.current = key;
  },[startMs,callId,recording.id]);
  useEffect(()=>{ applyTarget(audio.current); },[applyTarget,data?.exists]);
  if (isLoading) return <Text variant="muted">{t('common.loading')}</Text>;
  if (isError)
    return (
      <QueryErrorState
        message={t('calls.audioUnavailable')}
        onRetry={() => void refetch()}
      />
    );
  if (!data?.exists)
    return <Text variant="muted">{t('calls.audioUnavailable')}</Text>;
  const token = localStorage.getItem('accessToken');
  const src = `${getAuthApiBase()}/reports/calls/${encodeURIComponent(callId)}/recordings/${encodeURIComponent(recording.id)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  return (
    <VStack gap="8" align="stretch">
      <MediaAudio
        ref={audio}
        className={cls.audio}
        controls
        autoPlay={autoPlay}
        key={src}
        preload={startMs === undefined ? 'none' : 'metadata'}
        src={src}
        aria-label={t('calls.recording')}
        onError={() => setFailed(true)}
        onLoadedMetadata={event=>{event.currentTarget.playbackRate=Number(speed);applyTarget(event.currentTarget);}}
      />
      <Select
        aria-label={t('calls.playbackSpeed')}
        value={speed}
        onChange={(e) => {
          setSpeed(e.target.value);
          if (audio.current)
            audio.current.playbackRate = Number(e.target.value);
        }}
      >
        {['0.75', '1', '1.25', '1.5', '2'].map((value) => (
          <option key={value} value={value}>
            {value}×
          </option>
        ))}
      </Select>
      {failed && <Text role="alert">{t('calls.audioUnavailable')}</Text>}
    </VStack>
  );
}
