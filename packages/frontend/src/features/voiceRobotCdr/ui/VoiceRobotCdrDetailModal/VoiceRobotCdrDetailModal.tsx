import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/shared/config/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Flex, Text, ScrollArea, Badge, Separator } from '@/shared/ui';
import { useGetVoiceRobotCdrDetailQuery } from '@/shared/api/endpoints/voiceRobotCdrApi';
import { VoiceRobotCdrBadge } from '@/entities/voiceRobotCdr';
import { Phone, Clock, Hash, CheckSquare } from 'lucide-react';

interface VoiceRobotCdrDetailModalProps {
  cdrId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceRobotCdrDetailModal = memo(({ cdrId, isOpen, onClose }: VoiceRobotCdrDetailModalProps) => {
  const { t } = useTranslation();

  const formatActionTaken = (action: string) => {
    if (action.startsWith('voicerobot_keyword_')) return t('voiceRobots.cdr.actions.branch');
    if (action.startsWith('voicerobot_fallback_')) return t('voiceRobots.cdr.actions.fallbackContext');
    if (action === 'timeout') return t('voiceRobots.cdr.actions.timeout');
    if (action === 'fallback') return t('voiceRobots.cdr.actions.fallback');
    if (action === 'max_steps') return t('voiceRobots.cdr.actions.maxSteps');
    if (action === 'caller_hangup') return t('voiceRobots.cdr.actions.callerHangup');
    return action;
  };

  const { data, isLoading } = useGetVoiceRobotCdrDetailQuery(cdrId as number, {
    skip: !cdrId || !isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20">
          <DialogTitle className="flex items-center gap-4 text-xl">
            {t('voiceRobots.cdr.detail.title')} #{data?.cdr.uid}
            {data?.cdr && <VoiceRobotCdrBadge disposition={data.cdr.disposition} className="ml-auto" />}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="p-8 flex justify-center items-center h-64">
            <Text variant="muted">{t('common.loading')}</Text>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6 flex flex-col gap-8">
              {/* Summary info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-background/50 p-4 rounded-xl border border-muted/50">
                <VStackIcon icon={<Phone className="w-4 h-4 text-muted-foreground" />} title={t('voiceRobots.cdr.caller')}>
                  <div className="font-medium">{data.cdr.caller_id || 'Скрыт'}</div>
                  {data.cdr.caller_name && <div className="text-xs text-muted-foreground">{data.cdr.caller_name}</div>}
                </VStackIcon>
                
                <VStackIcon icon={<Clock className="w-4 h-4 text-muted-foreground" />} title={t('voiceRobots.cdr.date')}>
                  <div className="font-medium">
                    {new Date(data.cdr.started_at).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    }).replace(',', '')}
                  </div>
                  <div className="text-xs text-muted-foreground">{data.cdr.duration_seconds} сек</div>
                </VStackIcon>

                <VStackIcon icon={<Hash className="w-4 h-4 text-muted-foreground" />} title={t('voiceRobots.cdr.robot')}>
                  <div className="font-medium">{data.cdr.robot_name || `ID: ${data.cdr.robot_id}`}</div>
                  <div className="text-xs text-muted-foreground">{data.cdr.total_steps} шагов</div>
                </VStackIcon>

                <VStackIcon icon={<CheckSquare className="w-4 h-4 text-muted-foreground" />} title={t('voiceRobots.cdr.result')}>
                  <div className="font-medium truncate" title={data.cdr.last_action || '-'}>
                    {data.cdr.last_action || '-'}
                  </div>
                  {data.cdr.transfer_target && (
                    <div className="text-xs text-muted-foreground truncate" title={data.cdr.transfer_target}>
                      → {data.cdr.transfer_target}
                    </div>
                  )}
                </VStackIcon>
              </div>

              {/* Slots */}
              {data.cdr.collected_slots && Object.keys(data.cdr.collected_slots).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">
                    {t('voiceRobots.cdr.detail.slots')}
                  </h3>
                  <Flex gap="12" className="flex-wrap">
                    {Object.entries(data.cdr.collected_slots).map(([key, val]) => (
                      <div key={key} className="bg-muted/30 border border-muted/50 rounded-md px-3 py-1.5 flex gap-2 items-baseline">
                        <span className="text-xs text-muted-foreground font-medium">{key}:</span>
                        <span className="text-sm font-semibold">{String(val)}</span>
                      </div>
                    ))}
                  </Flex>
                </div>
              )}

              {/* Steps Timeline */}
              <div>
                <h3 className="text-sm font-semibold mb-4 text-foreground/80 uppercase tracking-wider">
                  {t('voiceRobots.cdr.detail.timeline')}
                </h3>
                <div className="relative border-l-2 border-muted/50 ml-3 pl-6 pb-2 space-y-6">
                  {data.logs.map((log) => (
                    <div key={log.uid} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-background border-2 border-indigo-500/50" />
                      
                      <Flex align="baseline" justify="between" className="mb-1">
                        <Text className="text-xs font-semibold text-muted-foreground">
                          {t('voiceRobots.cdr.detail.step')} {log.step_number}
                        </Text>
                        {log.timestamp && (
                          <Text className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                              hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </Text>
                        )}
                      </Flex>

                      <div className="bg-muted/10 border border-border/50 rounded-lg p-3 space-y-3">
                        {log.recognized_text && (
                          <div className="flex gap-2 items-start">
                            <Badge variant="outline" className="shrink-0 bg-orange-500/10 text-orange-600 border-orange-500/20">
                              {t('voiceRobots.cdr.detail.client')}
                            </Badge>
                            <span className="text-sm">{log.recognized_text}</span>
                          </div>
                        )}

                        <Flex align="center" gap="12" className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-muted/30">
                          {log.matched_keyword_id ? (
                            <span className="text-green-500 font-medium">
                              ✓ {log.matched_group_name || `${t('voiceRobots.cdr.detail.group')} #${log.matched_group_id}`} 
                              <span className="text-muted-foreground font-normal ml-1">
                                ({log.matched_keyword_name || `${t('voiceRobots.cdr.detail.keyword')} #${log.matched_keyword_id}`})
                              </span>
                            </span>
                          ) : (
                            <span className="text-red-400">✗ {t('voiceRobots.cdr.detail.noMatch')}</span>
                          )}
                          {log.match_confidence !== null && log.match_confidence !== undefined && (
                            <span>{t('voiceRobots.cdr.detail.conf')}: {Number(log.match_confidence).toFixed(2)}</span>
                          )}
                          {log.stt_duration_ms && <span>STT: {log.stt_duration_ms}ms</span>}
                          {log.action_taken && (
                            <span className="bg-muted/50 text-[11px] px-1.5 py-0.5 rounded">
                              {formatActionTaken(log.action_taken)}
                            </span>
                          )}
                        </Flex>

                        {log.ai_response && (
                          <div className="flex gap-2 items-start mt-2 pt-2 border-t border-border/30">
                            <Badge variant="outline" className="shrink-0 bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                              {t('voiceRobots.cdr.detail.robot')}
                            </Badge>
                            <span className="text-sm italic">{log.ai_response}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {data.logs.length === 0 && (
                    <Text variant="muted" className="text-sm italic">{t('common.noData')}</Text>
                  )}
                </div>
              </div>

            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
});

VoiceRobotCdrDetailModal.displayName = 'VoiceRobotCdrDetailModal';

const VStackIcon = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="flex gap-3 items-start">
    <div className="mt-0.5">{icon}</div>
    <div className="flex flex-col gap-0.5">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{title}</div>
      {children}
    </div>
  </div>
);
