import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetCompanyCallTranscriptQuery } from '@/shared/api/endpoints/callsApi';
import { Button, Flex, QueryErrorState, Text, VStack, InfoTooltip } from '@/shared/ui';
import { callDuration } from '../model/callsUrl';
import cls from './Calls.module.scss';

export function CallTranscript({
  callId,
  segment: targetSegment,
  onTarget,
}: {
  callId: string;
  segment?: string;
  onTarget?: (target:{recordingId:string;startMs:number;segmentId:string}|null)=>void;
}) {
  const { t } = useTranslation();
  const targetRef=useRef<HTMLDivElement>(null);
  const focusedTarget=useRef<string>('');
  const [startAtMatch, setStartAtMatch] = useState(Boolean(targetSegment));
  const [history, setHistory] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const {
    currentData: data,
    isFetching,
    isError,
    refetch,
  } = useGetCompanyCallTranscriptQuery(
    {
      id: callId,
      cursor: history.at(-1),
      ...(history.length === 1 && targetSegment && startAtMatch
        ? { segment: targetSegment }
        : {}),
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      pollingInterval: 30000,
    },
  );
  useEffect(()=>{
    const target = startAtMatch && !isError && data?.state === 'ready' && data.recordingId
      ? data.segments.find(s=>s.id===targetSegment) : undefined;
    onTarget?.(target && Number.isFinite(target.startMs) && target.startMs>=0
      ? {recordingId:data!.recordingId!,startMs:target.startMs,segmentId:target.id} : null);
    return ()=>onTarget?.(null);
  },[callId,targetSegment,startAtMatch,isError,data,onTarget]);
  useEffect(()=>{
    const key=`${callId}:${targetSegment}`;
    if(!startAtMatch || isError || !data || data.state!=='ready' || !targetSegment
      || !data.segments.some(s=>s.id===targetSegment) || focusedTarget.current===key) return;
    const target=targetRef.current;
    if(!target) return;
    target.scrollIntoView?.({block:'center'});
    target.focus({preventScroll:true});
    focusedTarget.current=key;
  },[callId,targetSegment,data,isError,startAtMatch]);
  const readFromStart = () => {
    setStartAtMatch(false);
    setHistory([undefined]);
  };
  if (isFetching && !data)
    return <Text role="status">{t('calls.transcriptLoading')}</Text>;
  if (isError)
    return (
      <VStack gap="12" align="stretch">
        <QueryErrorState
          message={t('calls.transcriptError')}
          onRetry={() => void refetch()}
        />
        {startAtMatch && (
          <Button variant="outline" onClick={readFromStart}>
            {t('calls.textSearch.readFromStart')}
          </Button>
        )}
      </VStack>
    );
  if (!data) return null;
  return (
    <VStack gap="12" align="stretch">
      {isFetching && <Text role="status">{t('calls.transcriptLoading')}</Text>}
      <Flex gap="4" align="center"><Text variant="h3">{t('calls.transcriptTitle')}</Text><InfoTooltip text={t('calls.transcriptOriginal')}/></Flex>
      {data.state === 'unavailable' ? (
        <Text variant="muted">{t('calls.transcriptUnavailable')}</Text>
      ) : (
        <>
          {startAtMatch && (
            <Button variant="outline" onClick={readFromStart}>
              {t('calls.textSearch.readFromStart')}
            </Button>
          )}
          {!data.segments.length && <Text>{t('calls.transcriptEmpty')}</Text>}
          {data.segments.map((segment) => (
            <Flex direction="column" key={segment.id} ref={segment.id===targetSegment?targetRef:undefined}
              tabIndex={segment.id===targetSegment?-1:undefined} data-cdr-found-segment={segment.id===targetSegment||undefined}>
            <VStack gap="4" className={cls.transcriptSegment}>
              {segment.id === targetSegment && (
                <Text>{t('calls.textSearch.found')}</Text>
              )}
              <Text variant="muted">
                {callDuration(Math.floor(segment.startMs / 1000))} -{' '}
                {callDuration(Math.floor(segment.endMs / 1000))} ·{' '}
                {t(`calls.transcriptSpeaker.${segment.speaker}`)}
              </Text>
              <Text className={cls.transcriptText}>{segment.text}</Text>
              {segment.textTruncated && (
                <Text variant="muted">
                  {t('calls.transcriptTextTruncated')}
                </Text>
              )}
            </VStack>
            </Flex>
          ))}
          <Flex gap="8" wrap="wrap">
            <Button
              variant="outline"
              disabled={history.length === 1}
              onClick={() => setHistory((value) => value.slice(0, -1))}
            >
              {t('common.back')}
            </Button>
            <Button
              variant="outline"
              disabled={!data.nextCursor}
              onClick={() => {
                if (data.nextCursor)
                  setHistory((value) => [...value, data.nextCursor!]);
              }}
            >
              {t('calls.transcriptNext')}
            </Button>
          </Flex>
        </>
      )}
    </VStack>
  );
}
