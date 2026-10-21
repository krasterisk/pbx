import { useTranslation } from 'react-i18next';
import { useGetCompanyCallAnalysisQuery } from '@/shared/api/endpoints/callsApi';
import { Badge, QueryErrorState, Text, VStack } from '@/shared/ui';

export function CallAnalysisCard({callId}:{callId:string}) {
  const {t}=useTranslation();
  const {currentData:data,isFetching,isError,refetch}=useGetCompanyCallAnalysisQuery(callId,{refetchOnMountOrArgChange:true,refetchOnFocus:true,pollingInterval:30000});
  if (isError) return <QueryErrorState message={t('calls.analysisCard.error','Не удалось получить разбор звонка')} onRetry={()=>void refetch()}/>;
  if (!data) return <Text role="status">{t('calls.analysisCard.loading','Загружаем разбор звонка…')}</Text>;
  if (data.state==='unavailable') return <Text variant="muted">{t('calls.analysisCard.unavailable','Доступного разбора пока нет')}</Text>;
  const value=(v:typeof data.metrics[number]['value'])=>v===null?t('calls.analysisCard.unknown','Недостаточно данных'):typeof v==='boolean'?t(v?'calls.analysisCard.yes':'calls.analysisCard.no',v?'Да':'Нет'):Array.isArray(v)?v.join(', ')||t('calls.analysisCard.unknown','Недостаточно данных'):String(v);
  return <VStack gap="12" align="stretch" data-testid="call-analysis-card">
    <Text variant="h3">{t('calls.analysisCard.title','Разбор разговора')}</Text>
    {data.projectName && <Text variant="muted">{data.projectName}</Text>}
    {isFetching && <Text role="status">{t('calls.analysisCard.loading','Загружаем разбор звонка…')}</Text>}
    {data.privacyProtected && <Badge variant="secondary">{t('calls.analysisCard.protected','Облачный разбор по обезличенному тексту')}</Badge>}
    {data.timingAdjusted && <Text variant="muted">{t('calls.analysisCard.timingAdjusted','Таймкоды уточнены по длительности записи')}</Text>}
    {data.summary ? <Text>{data.summary}</Text> : <Text variant="muted">{t('calls.analysisCard.noSummary','Саммари не сформировано')}</Text>}
    {data.summaryTruncated && <Text variant="muted">{t('calls.analysisCard.truncated','Саммари показано не полностью')}</Text>}
    <dl>
      {data.metrics.map(metric=><div key={metric.id}>
        <dt><Text variant="muted">{t(`calls.analysisCard.metrics.${metric.id}`,metric.label)}</Text></dt>
        <dd><Text>{metric.status==='not_applicable'?t('calls.analysisCard.notApplicable','Не применимо'):metric.status==='insufficient_evidence'?t('calls.analysisCard.insufficientEvidence','Недостаточно подтверждений'):value(metric.value)}{metric.unit && metric.value!==null && (!metric.status || metric.status==='assessed')?` ${metric.unit}`:''}</Text>{metric.rationale && <Text variant="muted">{metric.rationale}</Text>}{metric.quote && <blockquote><Text variant="muted">{metric.quote}</Text></blockquote>}</dd>
      </div>)}
    </dl>
    <Text variant="muted">{t('calls.analysisCard.modelAssessment','Оценки модели. Для проверки откройте исходную расшифровку и запись.')}</Text>
  </VStack>;
}
