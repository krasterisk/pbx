import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/shared/config/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Flex, Text, ScrollArea, Badge, Tooltip } from '@/shared/ui';
import { useGetVoiceRobotCdrDetailQuery } from '@/shared/api/endpoints/voiceRobotCdrApi';
import { VoiceRobotCdrBadge } from '@/entities/voiceRobotCdr';
import { Phone, Clock, Hash, CheckSquare, ChevronDown, ChevronRight, Database } from 'lucide-react';

interface VoiceRobotCdrDetailModalProps {
  cdrId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Get a human-readable label for a slot key via i18n */
function getSlotLabel(key: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const i18nKey = `voiceRobots.cdr.detail.slotLabels.${key}`;
  const translated = t(i18nKey, { defaultValue: '' });
  // If i18n has a translation, use it
  if (translated && translated !== i18nKey) return translated;
  // Fallback: transform snake_case / camelCase to readable format
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase());
}

/** Check if a value is a non-null object (not array) */
function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/** Recursively render a nested object as a key-value list */
function ObjectValueRenderer({ value, t, level = 0 }: { value: unknown; t: TFunc; level?: number }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">[]</span>;
    return (
      <div className="space-y-1">
        {value.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="text-muted-foreground text-[11px] shrink-0">{idx + 1}.</span>
            <ObjectValueRenderer value={item} t={t} level={level + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="text-muted-foreground italic">{'{}'}</span>;
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 items-start">
            <span className="text-muted-foreground text-[11px] font-medium shrink-0">{getSlotLabel(k, t)}:</span>
            <div className="min-w-0">
              <ObjectValueRenderer value={v} t={t} level={level + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

/** Expandable section for complex object values */
function ExpandableObjectSlot({ label, value }: { label: string; value: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const entries = Object.entries(value);
  const previewCount = entries.length;

  return (
    <div className="bg-muted/20 border border-muted/40 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-xs font-semibold text-foreground/80">{label}</span>
        <span className="text-[11px] text-muted-foreground ml-auto mr-1">
          {previewCount} {t('voiceRobots.cdr.detail.fields')}
        </span>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        }
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-muted/30 text-sm space-y-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2 items-start">
              <span className="text-xs text-muted-foreground font-medium shrink-0 min-w-[80px]">{getSlotLabel(k, t)}:</span>
              <div className="text-sm break-all min-w-0">
                <ObjectValueRenderer value={v} t={t} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  /** Render a single slot value: string/number inline, objects as expandable */
  const renderSlotEntry = (key: string, val: unknown) => {
    const label = getSlotLabel(key, t);

    // Complex object → expandable section
    if (isPlainObject(val) && Object.keys(val).length > 0) {
      return <ExpandableObjectSlot key={key} label={label} value={val as Record<string, unknown>} />;
    }

    // Array → show as comma-separated or expandable if complex
    if (Array.isArray(val)) {
      const allPrimitive = val.every((v) => typeof v !== 'object' || v === null);
      if (allPrimitive) {
        return (
          <div key={key} className="bg-muted/30 border border-muted/50 rounded-md px-3 py-1.5 flex gap-2 items-baseline max-w-full overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium shrink-0">{label}:</span>
            <span className="text-sm font-semibold truncate">{val.join(', ')}</span>
          </div>
        );
      }
      return <ExpandableObjectSlot key={key} label={label} value={Object.fromEntries(val.map((v, i) => [String(i + 1), v]))} />;
    }

    // Primitive value → compact badge
    const displayValue = val === null || val === undefined ? '—' : String(val);
    return (
      <div key={key} className="bg-muted/30 border border-muted/50 rounded-md px-3 py-1.5 flex gap-2 items-baseline max-w-full overflow-hidden">
        <span className="text-xs text-muted-foreground font-medium shrink-0">{label}:</span>
        <Tooltip content={displayValue.length > 50 ? displayValue : undefined}>
          <span className="text-sm font-semibold break-all line-clamp-2">{displayValue}</span>
        </Tooltip>
      </div>
    );
  };

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

              {/* Slots / Collected Data */}
              {data.cdr.collected_slots && Object.keys(data.cdr.collected_slots).length > 0 && (
                <div className="overflow-hidden">
                  <h3 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">
                    {t('voiceRobots.cdr.detail.slots')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.cdr.collected_slots).map(([key, val]) =>
                      renderSlotEntry(key, val)
                    )}
                  </div>
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
                      
                      <Flex justify="between" className="mb-1 items-baseline">
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
                          {log.matched_keyword_id && log.matched_keyword_id !== -1 ? (
                            <span className="text-green-500 font-medium">
                              ✓ {log.matched_group_name || `${t('voiceRobots.cdr.detail.group')} #${log.matched_group_id}`} 
                              <span className="text-muted-foreground font-normal ml-1">
                                ({log.matched_keyword_name || `${t('voiceRobots.cdr.detail.keyword')} #${log.matched_keyword_id}`})
                              </span>
                            </span>
                          ) : log.matched_keyword_id === -1 ? (
                            <span className="text-blue-400 font-medium">
                              ⟳ Webhook
                            </span>
                          ) : (
                            <span className="text-red-400">✗ {t('voiceRobots.cdr.detail.noMatch')}</span>
                          )}
                          {log.match_confidence !== null && log.match_confidence !== undefined && log.matched_keyword_id !== -1 && (
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
