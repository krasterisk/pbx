import { Textarea } from '@/shared/ui';
import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildCmdSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'command',
      kind: 'custom',
      required: true,
      labelKey: 'routes.chain.cmd.command',
      label: t('routes.chain.cmd.command', 'Команда dialplan'),
      hintKey: 'routes.chain.cmd.hint',
      hint: t(
        'routes.chain.cmd.hint',
        'Произ произвольная строка dialplan (без перевода строк).\nДоступно **только администратору** маршрута.\nИспользуйте осознанно — ошибка может сломать контекст.',
      ),
      render: ({ params, onChange, readOnly, field }) => (
        <Textarea
          value={String(params.command ?? '')}
          disabled={readOnly}
          rows={4}
          aria-label={field.label ?? t('routes.chain.cmd.command', 'Команда dialplan')}
          placeholder={t('routes.chain.cmd.placeholder', 'Например: NoOp(отладка)')}
          onChange={(e) => onChange({ command: e.target.value })}
        />
      ),
    },
  ];
}

export function cmdFieldErrors(params: Record<string, unknown>): Record<string, string> {
  const command = String(params.command ?? '').trim();
  if (!command) return { command: 'required' };
  if (/[\n\r]/.test(command)) return { command: 'invalid' };
  return {};
}

export function summarizeCmd(params: Record<string, unknown>, t: TFn): string {
  const command = String(params.command ?? '').trim();
  if (!command) return t('routes.chain.cmd.summaryEmpty', 'Команда: не задана');
  const preview = command.length > 40 ? `${command.slice(0, 40)}…` : command;
  return t('routes.chain.cmd.summary', 'Команда: {{preview}}').replace('{{preview}}', preview);
}
