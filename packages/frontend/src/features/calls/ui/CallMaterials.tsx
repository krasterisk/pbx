import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Play, X, Voicemail } from 'lucide-react';
import type { CallRecord } from '@krasterisk/shared';
import { Button, Flex, Text, Tooltip, VStack } from '@/shared/ui';
import { CallAudio } from './CallRecordingAudio';

export function CallMaterials({ call, onTranscript, onVoicemail }: { call: CallRecord; onTranscript: () => void; onVoicemail?: (id: string) => void }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  return <VStack gap="8" align="stretch" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <Flex gap="8" align="center">
      {!!call.recordings.length && <Tooltip content={t(playing ? 'common.close' : 'calls.playRecording')}><Button size="icon" variant="ghost" aria-label={t(playing ? 'common.close' : 'calls.playRecording')} aria-expanded={playing} onClick={() => setPlaying(!playing)}>{playing ? <X size={16}/> : <Play size={16}/>}</Button></Tooltip>}
      {call.analytics?.state === 'analyzed' && <Tooltip content={t('calls.showTranscript')}><Button size="icon" variant="ghost" aria-label={t('calls.showTranscript')} onClick={onTranscript}><FileText size={16}/></Button></Tooltip>}
      {call.hasVoicemail && (call.voicemailCallId && onVoicemail ? <Tooltip content={t('calls.voicemail')}><Button size="icon" variant="ghost" aria-label={t('calls.voicemail')} onClick={() => onVoicemail(call.voicemailCallId!)}><Voicemail size={16}/></Button></Tooltip> : <Text variant="muted">{t('calls.voicemail')}</Text>)}
      {!call.recordings.length && !call.hasVoicemail && call.analytics?.state !== 'analyzed' && <Text variant="muted">{call.analytics && call.analytics.state !== 'none' ? t(`calls.analysis.${call.analytics.state}`) : '-'}</Text>}
    </Flex>
    {playing && call.recordings.map((recording, index) => <CallAudio key={recording.id} recording={recording} callId={call.id} autoPlay={index === 0} />)}
  </VStack>;
}
