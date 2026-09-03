import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { IVoicemailMessage, TranscriptStatus } from '@krasterisk/shared';
import {
  useGetVoicemailByUniqueidQuery,
  useRetryVoicemailSttMutation,
  voicemailPlayUrl,
} from '@/shared/api/endpoints/voicemailApi';
import { getAuthApiBase } from '@/shared/api/apiBase';
import { Button, SkeletonText, Text } from '@/shared/ui';
import { AudioPlayer } from '@/shared/ui/AudioPlayer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';
import cls from './VoicemailDetailsModal.module.scss';

export interface VoicemailDetailsModalProps {
  uniqueid: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function jwtPlaySrc(uniqueid: string, download = false): string {
  const path = voicemailPlayUrl(uniqueid, download ? { download: true } : undefined);
  const base = getAuthApiBase();
  let url = `${base}${path}`;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) {
    url += `${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }
  return url;
}

function formatDuration(sec?: number): string {
  if (sec == null || !Number.isFinite(sec)) return '';
  const total = Math.max(0, Math.trunc(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(value: IVoicemailMessage['created_at']): string {
  const raw = value instanceof Date ? value.toISOString() : String(value ?? '');
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('ru-RU');
}

function isReady(status: TranscriptStatus | string): boolean {
  return status === 'ready' || status === 'done';
}

export const VoicemailDetailsModal = memo(({
  uniqueid,
  isOpen,
  onClose,
}: VoicemailDetailsModalProps) => {
  const { t } = useTranslation();
  const { data } = useGetVoicemailByUniqueidQuery(uniqueid!, {
    skip: !uniqueid || !isOpen,
  });
  const [retryStt] = useRetryVoicemailSttMutation();

  const handleRetry = useCallback(() => {
    if (!uniqueid) return;
    void retryStt(uniqueid);
  }, [retryStt, uniqueid]);

  const status = data?.transcript_status ?? 'pending';
  const playSrc = uniqueid ? jwtPlaySrc(uniqueid) : '';
  const downloadHref = uniqueid ? jwtPlaySrc(uniqueid, true) : '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>
            {t('cdr.voicemail.detailsTitle', 'Детали сообщения')}
          </DialogTitle>
        </DialogHeader>

        <div className={cls.scrollBody}>
          <Text className={cls.route}>
            {data ? `${data.caller_id} → ${data.exten}` : t('cdr.voicemail.loading', 'Загрузка')}
          </Text>
          {data && (
            <div className={cls.headerMeta}>
              <span>{formatDate(data.created_at)}</span>
              <span>{formatDuration(data.duration_sec)}</span>
            </div>
          )}

          <div className={cls.playerRow}>
            <AudioPlayer src={playSrc} />
            {downloadHref && (
              <Button asChild variant="outline" size="sm" className={cls.download}>
                <a href={downloadHref} download>
                  <Download className="h-4 w-4" />
                  {t('cdr.voicemail.download', 'Скачать')}
                </a>
              </Button>
            )}
          </div>

          {status === 'pending' && (
            <div>
              <SkeletonText lines={3} />
              <Text className={cls.muted}>
                {t('cdr.voicemail.pending', 'Расшифровка готовится')}
              </Text>
            </div>
          )}

          {isReady(status) && (
            <>
              <div className={cls.summaryCard}>
                <Text variant="small">
                  {t('cdr.voicemail.summary', 'Краткое содержание')}
                </Text>
                <Text>{data?.summary || t('cdr.voicemail.summaryEmpty', 'Нет краткого содержания')}</Text>
              </div>
              <div>
                <Text variant="small">
                  {t('cdr.voicemail.transcript', 'Расшифровка')}
                </Text>
                <Text className={cls.transcript}>{data?.transcript || ''}</Text>
              </div>
            </>
          )}

          {status === 'failed' && (
            <div>
              <Text className={cls.failed}>
                {t('cdr.voicemail.failed', 'Не удалось расшифровать сообщение')}
              </Text>
              <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                {t('cdr.voicemail.retry', 'Повторить расшифровку')}
              </Button>
            </div>
          )}

          {status === 'not_configured' && (
            <div>
              <Text className={cls.muted}>
                {t(
                  'cdr.voicemail.notConfigured',
                  'Расшифровка недоступна: не настроен STT-движок',
                )}
              </Text>
              <a href="/settings/stt-engines" className={cls.sttLink}>
                {t('cdr.voicemail.sttSettings', 'Настройки STT-движков')}
              </a>
            </div>
          )}

          <div className={cls.meta}>
            <span>
              {t('cdr.voicemail.recordStatus', 'RECORD_STATUS')}
              {': '}
              {data?.record_status || ''}
            </span>
            {' / '}
            <span>
              {t('cdr.voicemail.stt', 'STT')}
              {': '}
              {status}
            </span>
            {' / '}
            <span>
              {t('cdr.voicemail.llm', 'LLM')}
              {': '}
              {data?.summary ? t('cdr.voicemail.llmReady', 'готово') : t('cdr.voicemail.llmEmpty', 'нет')}
            </span>
            {data?.notify_status === 'failed' && (
              <span>
                {' / '}
                {t('cdr.voicemail.notifyFailed', 'Уведомление не доставлено')}
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

VoicemailDetailsModal.displayName = 'VoicemailDetailsModal';
