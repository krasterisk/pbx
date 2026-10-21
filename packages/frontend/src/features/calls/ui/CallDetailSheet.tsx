import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CallParty } from '@krasterisk/shared';
import { useGetCompanyCallQuery } from '@/shared/api/endpoints/callsApi';
import {
  Badge,
  Button,
  Flex,
  ModalBody,
  QueryErrorState,
  Sheet,
  FormSheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Text,
  VStack,
} from '@/shared/ui';
import { callDuration, callTime, callOutcomeKey } from '../model/callsUrl';
import cls from './Calls.module.scss';
import { CallRouteView } from './CallRouteView';
import { CallTranscript } from './CallTranscript';
import { CallAudio } from './CallRecordingAudio';
import { CallAnalysisCard } from './CallAnalysisCard';
import { PhoneNumber } from '@/entities/phone';
export function partyLabel(party: CallParty, unknown: string): string {
  if (party.name) return party.name;
  const number = party.number;
  if (!number || !/^[+\d\s().*-]+$/.test(number)) return unknown;
  const digits = number.replace(/\D/g, '');
  return /^7\d{10}$/.test(digits)
    ? `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
    : number;
}
export function CallDetailSheet({
  id,
  onClose,
  onVoicemailClick,
  transcriptSegment,
}: {
  id: string | null;
  onClose: () => void;
  onVoicemailClick?: (id: string) => void;
  transcriptSegment?:string;
}) {
  const { t, i18n } = useTranslation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const {
    currentData: data,
    isLoading,
    isError,
    refetch,
  } = useGetCompanyCallQuery(id || '', { skip: !id });
  const [tab, setTab] = useState(transcriptSegment?'recordings':'journey');
  const call = data?.call;
  const [audioTarget,setAudioTarget]=useState<{recordingId:string;startMs:number;segmentId:string}|null>(null);
  const label = (party: CallParty | null) =>
    party
      ? partyLabel(party, t(`calls.actor.${party.kind}`))
      : t('calls.unknown');
  return (
    <Sheet
      open={Boolean(id)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <FormSheetContent className={cls.sheet} aria-describedby={undefined}
        onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}>
        <SheetHeader>
          <SheetTitle ref={titleRef} tabIndex={-1} className={cls.sheetTitle}>{t('calls.callDetails')}</SheetTitle>
          {call && (
            <VStack gap="8" align="stretch">
              <Text variant="h2">
                <PhoneNumber number={call.caller.number} name={call.caller.name} fallback={label(call.caller)}/> → <PhoneNumber number={call.recipient.number} name={call.recipient.name} fallback={label(call.recipient)}/>
              </Text>
              <Text variant="muted">
                {call.recipient.department}
              </Text>
              <Flex gap="8" wrap="wrap">
                <Badge variant="secondary">{t(callOutcomeKey(call))}</Badge>
                <Text variant="muted">
                  {callTime(call.startedAt, data.timezone, i18n.language)} ·{' '}
                  {data.timezone}
                </Text>
              </Flex>
              <Flex gap="8" wrap="wrap">
                {call.origin === 'autodial' && (
                  <Badge variant="outline">{t('calls.autodial')}</Badge>
                )}
                {call.handling.map((kind) => (
                  <Badge key={kind} variant="outline">
                    {t(`calls.actor.${kind}`)}
                  </Badge>
                ))}
              </Flex>
              <Text variant="muted">
                {t('calls.wait')}:{' '}
                {callDuration(call.waitSec, call.timingSource === 'cdr')} ·{' '}
                {t('calls.connected')}:{' '}
                {callDuration(call.connectedSec, call.timingSource === 'cdr')} ·{' '}
                {t('calls.totalDuration')}: {callDuration(call.durationSec)}
              </Text>
            </VStack>
          )}
        </SheetHeader>
        <ModalBody>
          {isLoading && <Text>{t('common.loading')}</Text>}
          {isError && (
            <QueryErrorState
              message={t('calls.detailError')}
              onRetry={() => void refetch()}
            />
          )}
          {call && (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="journey">{t('calls.journey')}</TabsTrigger>
                <TabsTrigger value="recordings">
                  {t('calls.materials')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="journey">
                <CallRouteView
                  call={call}
                  timezone={data.timezone}
                  label={label}
                />
              </TabsContent>
              <TabsContent value="recordings">
                <VStack gap="16" align="stretch">
                  {call.recordings.length ? (
                    call.recordings.map((recording, index) => (
                      <VStack key={recording.id} gap="8" align="stretch">
                        <Text>
                          {t('calls.recording')} {index + 1}
                        </Text>
                        <CallAudio recording={recording} callId={call.id} startMs={audioTarget?.recordingId===recording.id ? audioTarget.startMs : undefined} />
                      </VStack>
                    ))
                  ) : (
                    <Text variant="muted">{t('calls.noRecording')}</Text>
                  )}
                  {call.analytics && (
                    <VStack gap="8" align="stretch">
                      <Text>
                        {t('calls.analytics')}:{' '}
                        {t(`calls.analysis.${call.analytics.state}`)}
                      </Text>
                      {call.analytics.recordingId && (
                        <Button variant="outline" asChild>
                          <a
                            href={`/speech-analytics/recordings/${encodeURIComponent(call.analytics.recordingId)}`}
                          >
                            {t('calls.openAnalytics')}
                          </a>
                        </Button>
                      )}
                    </VStack>
                  )}
                  {(call.analytics?.state === 'analyzed' || transcriptSegment) && <>
                    {transcriptSegment && <CallTranscript key={call.id+':'+transcriptSegment} callId={call.id} segment={transcriptSegment} onTarget={setAudioTarget} />}
                    <CallAnalysisCard key={call.id} callId={call.id}/>
                    {!transcriptSegment && <CallTranscript key={call.id} callId={call.id} />}
                  </>}
                  {call.hasVoicemail && (
                    <VStack gap="8" align="stretch">
                      <Text>{t('calls.hasVoicemail')}</Text>
                      {call.voicemailCallId && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            onVoicemailClick?.(call.voicemailCallId!)
                          }
                        >
                          {t('calls.voicemail')}
                        </Button>
                      )}
                    </VStack>
                  )}
                </VStack>
              </TabsContent>
            </Tabs>
          )}
        </ModalBody>
      </FormSheetContent>
    </Sheet>
  );
}
