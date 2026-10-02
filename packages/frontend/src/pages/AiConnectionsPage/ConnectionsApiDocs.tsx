import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Copy, Info } from 'lucide-react';
import { Button, Card, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import cls from './AiConnectionsPage.module.scss';

interface DocEntry {
  method: 'GET' | 'POST';
  path: string;
  title: string;
  body: string;
}

function docs(base: string): DocEntry[] {
  return [
    {
      method: 'POST',
      path: '/v1/speech-analytics/uploads/batch',
      title: 'Загрузка файлов',
      body: `Заголовки:
Authorization: Bearer <токен>
Content-Type: application/json

Тело:
{
  "files": [{ "filename": "call.mp3", "bytesBase64": "..." }],
  "operator": { "name": "Ольга" },
  "clientPhone": "+79991234567",
  "language": "ru",
  "sync": false
}

Проект берётся из токена. Другой projectId в теле отклоняется.
Ответ всегда HTTP 202.
Один файл и sync=true ждёт разбор: kind=sync_result, в results — summary.
Иначе kind=accepted, разбор идёт дальше. Метрики потом читаются методом result.

curl -X POST ${base}/v1/speech-analytics/uploads/batch \\
  -H "Authorization: Bearer <токен>" \\
  -H "Content-Type: application/json" \\
  -d '{"files":[{"filename":"call.mp3","bytesBase64":"..."}],"language":"ru"}'`,
    },
    {
      method: 'POST',
      path: '/v1/speech-analytics/analyze-url',
      title: 'Анализ по ссылке',
      body: `Тело:
{
  "urls": ["https://example.com/call.mp3"],
  "operator": { "name": "Ольга" },
  "clientPhone": "+79991234567",
  "language": "ru",
  "sync": false
}

Проект берётся из токена. Другой projectId в теле отклоняется.
Ответ всегда HTTP 202.
Один URL и sync=true ждёт разбор: kind=sync_result и summary.
Несколько URL или sync=false: kind=accepted.

curl -X POST ${base}/v1/speech-analytics/analyze-url \\
  -H "Authorization: Bearer <токен>" \\
  -H "Content-Type: application/json" \\
  -d '{"urls":["https://example.com/call.mp3"],"language":"ru"}'`,
    },
    {
      method: 'GET',
      path: '/v1/speech-analytics/recordings',
      title: 'Список записей проекта',
      body: `До 25 записей проекта этого токена, новые первыми.
Нужен доступ analytics:read.

curl "${base}/v1/speech-analytics/recordings" \\
  -H "Authorization: Bearer <токен>"`,
    },
    {
      method: 'GET',
      path: '/v1/speech-analytics/analysis-runs/:id',
      title: 'Статус разбора',
      body: `Ответ: { run, recording, result, transcript: null }
Состояние в run.state. result появляется, когда разбор уже посчитан.

curl "${base}/v1/speech-analytics/analysis-runs/<id>" \\
  -H "Authorization: Bearer <токен>"`,
    },
    {
      method: 'GET',
      path: '/v1/speech-analytics/analysis-runs/:id/result',
      title: 'Результат: метрики и саммари',
      body: `Тот же объект, что у статуса.
Итог: result.summary
Метрики опубликованной версии проекта: result.metric_results (JSON).

curl "${base}/v1/speech-analytics/analysis-runs/<id>/result" \\
  -H "Authorization: Bearer <токен>"`,
    },
    {
      method: 'GET',
      path: '/v1/speech-analytics/analysis-runs/:id/transcript',
      title: 'Расшифровка',
      body: `Тот же объект плюс transcript и segments.
Текст реплики: segments[].text
Роль: speaker_role. Время: start_ms и end_ms.
Нужен доступ analytics:transcript.

curl "${base}/v1/speech-analytics/analysis-runs/<id>/transcript" \\
  -H "Authorization: Bearer <токен>"`,
    },
  ];
}

export const ConnectionsApiDocs = memo(() => {
  const { t } = useTranslation();
  const base = `${window.location.origin}/api`;
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(value);
      window.setTimeout(() => setCopied((current) => (current === value ? null : current)), 2000);
    });
  };

  return (
    <VStack gap="16" max className={cls.docs} data-testid="sa-api-docs">
      <VStack gap="6">
        <Text variant="h2" as="h2">{t('aiProducts.connections.docsTitle', 'Документация API')}</Text>
        <HStack gap="8" align="start">
          <Info size={16} className={cls.docsNoteIcon} aria-hidden />
          <Text variant="muted">
            {t('aiProducts.connections.docsNote', 'Токен привязан к проекту. Звонки, отправленные с этим токеном, попадают в этот проект. Заголовок: Authorization: Bearer <токен>.')}
          </Text>
        </HStack>
      </VStack>
      <HStack gap="8" align="center" className={cls.baseBar}>
        <Text variant="small" className={cls.baseLabel}>Base URL</Text>
        <Text as="code" className={cls.path}>{base}</Text>
        <Button type="button" variant="outline" onClick={() => copy(base)}>
          <Copy size={16} />
          {copied === base
            ? t('aiProducts.connections.docsCopied', 'Скопировано')
            : t('aiProducts.connections.docsCopyUrl', 'Скопировать URL')}
        </Button>
      </HStack>
      <VStack gap="8" max>
        {docs(base).map((entry) => {
          const open = openPath === entry.path;
          const fullUrl = `${base}${entry.path}`;
          return (
            <Card key={entry.path} className={`${cls.docEntry} p-0 ${open ? cls.docEntryOpen : ''}`}>
              <Flex gap="8" align="center" justify="between" max className={cls.docHeader}>
                <Flex
                  gap="12"
                  align="center"
                  max
                  className={cls.docHit}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => setOpenPath(open ? null : entry.path)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setOpenPath(open ? null : entry.path);
                    }
                  }}
                >
                  <Text as="span" className={`${cls.method} ${entry.method === 'GET' ? cls.methodGet : cls.methodPost}`}>{entry.method}</Text>
                  <Text as="code" className={cls.path}>{entry.path}</Text>
                  <Text variant="muted" className={cls.docTitle}>{entry.title}</Text>
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Flex>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t('aiProducts.connections.docsCopyUrl', 'Скопировать URL')}
                  onClick={() => copy(fullUrl)}
                >
                  <Copy size={16} />
                </Button>
              </Flex>
              {open ? <Text as="pre" className={cls.code}>{entry.body}</Text> : null}
            </Card>
          );
        })}
      </VStack>
    </VStack>
  );
});

ConnectionsApiDocs.displayName = 'ConnectionsApiDocs';
