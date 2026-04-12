import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { type IRouteAction, type ActionType } from '@/shared/api/api';
import styles from './ActionsTableEditor.module.scss';

/** All available action types */
const ACTION_TYPES: { value: ActionType; labelKey: string }[] = [
  { value: 'totrunk', labelKey: 'routes.action.totrunk' },
  { value: 'toexten', labelKey: 'routes.action.toexten' },
  { value: 'toqueue', labelKey: 'routes.action.toqueue' },
  { value: 'togroup', labelKey: 'routes.action.togroup' },
  { value: 'tolist', labelKey: 'routes.action.tolist' },
  { value: 'toivr', labelKey: 'routes.action.toivr' },
  { value: 'toroute', labelKey: 'routes.action.toroute' },
  { value: 'playprompt', labelKey: 'routes.action.playprompt' },
  { value: 'playback', labelKey: 'routes.action.playback' },
  { value: 'setclid_custom', labelKey: 'routes.action.setclid_custom' },
  { value: 'setclid_list', labelKey: 'routes.action.setclid_list' },
  { value: 'sendmail', labelKey: 'routes.action.sendmail' },
  { value: 'sendmailpeer', labelKey: 'routes.action.sendmailpeer' },
  { value: 'telegram', labelKey: 'routes.action.telegram' },
  { value: 'voicemail', labelKey: 'routes.action.voicemail' },
  { value: 'text2speech', labelKey: 'routes.action.text2speech' },
  { value: 'asr', labelKey: 'routes.action.asr' },
  { value: 'keywords', labelKey: 'routes.action.keywords' },
  { value: 'webhook', labelKey: 'routes.action.webhook' },
  { value: 'confbridge', labelKey: 'routes.action.confbridge' },
  { value: 'cmd', labelKey: 'routes.action.cmd' },
  { value: 'tofax', labelKey: 'routes.action.tofax' },
  { value: 'label', labelKey: 'routes.action.label' },
  { value: 'busy', labelKey: 'routes.action.busy' },
  { value: 'hangup', labelKey: 'routes.action.hangup' },
];

const DIALSTATUS_OPTIONS = [
  { value: '', label: 'Любой' },
  { value: 'CHANUNAVAIL', label: 'Не доступен' },
  { value: 'BUSY', label: 'Занят' },
  { value: 'NOANSWER', label: 'Не отвечает' },
];

interface ActionsTableEditorProps {
  actions: IRouteAction[];
  onChange: (actions: IRouteAction[]) => void;
}

export const ActionsTableEditor = memo(({ actions, onChange }: ActionsTableEditorProps) => {
  const { t } = useTranslation();

  const addAction = useCallback(() => {
    const newAction: IRouteAction = {
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'hangup',
      params: {},
      condition: { dialstatus: '', calendar: '' },
    };
    onChange([...actions, newAction]);
  }, [actions, onChange]);

  const removeAction = useCallback((id: string) => {
    onChange(actions.filter((a) => a.id !== id));
  }, [actions, onChange]);

  const updateAction = useCallback((id: string, field: string, value: any) => {
    onChange(actions.map((a) => {
      if (a.id !== id) return a;
      if (field === 'type') {
        return { ...a, type: value as ActionType, params: {} };
      }
      if (field.startsWith('params.')) {
        const paramKey = field.slice(7);
        return { ...a, params: { ...a.params, [paramKey]: value } };
      }
      if (field.startsWith('condition.')) {
        const condKey = field.slice(10);
        return { ...a, condition: { ...a.condition, [condKey]: value } };
      }
      return a;
    }));
  }, [actions, onChange]);

  const moveAction = useCallback((fromIdx: number, toIdx: number) => {
    const newActions = [...actions];
    const [moved] = newActions.splice(fromIdx, 1);
    newActions.splice(toIdx, 0, moved);
    onChange(newActions);
  }, [actions, onChange]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thGrip}></th>
              <th className={styles.thNum}>№</th>
              <th className={styles.thType}>{t('routes.actionType', 'Действие')}</th>
              <th className={styles.thParams}>{t('routes.actionParams', 'Параметры')}</th>
              <th className={styles.thCondition}>{t('routes.condition', 'Условие')}</th>
              <th className={styles.thRemove}></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action, idx) => (
              <tr key={action.id} className={styles.row}>
                <td className={styles.grip}>
                  <button
                    type="button"
                    className={styles.gripBtn}
                    onMouseDown={(e) => e.preventDefault()}
                    title="Перетащите для изменения порядка"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  {idx > 0 && (
                    <button type="button" className={styles.moveBtn} onClick={() => moveAction(idx, idx - 1)} title="Вверх">↑</button>
                  )}
                  {idx < actions.length - 1 && (
                    <button type="button" className={styles.moveBtn} onClick={() => moveAction(idx, idx + 1)} title="Вниз">↓</button>
                  )}
                </td>
                <td className={styles.num}>{idx + 1}</td>
                <td>
                  <select
                    className={styles.select}
                    value={action.type}
                    onChange={(e) => updateAction(action.id, 'type', e.target.value)}
                  >
                    {ACTION_TYPES.map((at) => (
                      <option key={at.value} value={at.value}>
                        {t(at.labelKey, at.value)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <ActionParams action={action} onUpdate={updateAction} />
                </td>
                <td>
                  <select
                    className={styles.selectSmall}
                    value={action.condition.dialstatus}
                    onChange={(e) => updateAction(action.id, 'condition.dialstatus', e.target.value)}
                  >
                    {DIALSTATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeAction(action.id)}
                    title={t('common.delete', 'Удалить')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="ghost" size="sm" onClick={addAction} className={styles.addBtn}>
        <Plus className="w-4 h-4 mr-1" />
        {t('routes.addAction', 'Добавить действие')}
      </Button>
    </div>
  );
});

ActionsTableEditor.displayName = 'ActionsTableEditor';

/** Dynamic parameter fields based on action type */
function ActionParams({ action, onUpdate }: {
  action: IRouteAction;
  onUpdate: (id: string, field: string, value: any) => void;
}) {
  const p = action.params;
  const id = action.id;

  switch (action.type) {
    case 'totrunk':
      return (
        <div className={styles.params}>
          <input className={styles.inputSm} value={p.trunk || ''} onChange={(e) => onUpdate(id, 'params.trunk', e.target.value)} placeholder="PJSIP/trunk" />
          <input className={styles.inputSm} value={p.dest || ''} onChange={(e) => onUpdate(id, 'params.dest', e.target.value)} placeholder="Номер / ${EXTEN}" />
          <input className={styles.inputXs} value={p.timeout || ''} onChange={(e) => onUpdate(id, 'params.timeout', e.target.value)} placeholder="сек" />
          <input className={styles.inputXs} value={p.options || ''} onChange={(e) => onUpdate(id, 'params.options', e.target.value)} placeholder="tT" />
        </div>
      );
    case 'toexten':
      return (
        <div className={styles.params}>
          <input className={styles.inputSm} value={p.exten || ''} onChange={(e) => onUpdate(id, 'params.exten', e.target.value)} placeholder="PJSIP/200" />
          <input className={styles.inputXs} value={p.timeout || ''} onChange={(e) => onUpdate(id, 'params.timeout', e.target.value)} placeholder="сек" />
          <input className={styles.inputXs} value={p.options || ''} onChange={(e) => onUpdate(id, 'params.options', e.target.value)} placeholder="tThH" />
        </div>
      );
    case 'toqueue':
      return (
        <div className={styles.params}>
          <input className={styles.inputSm} value={p.queue || ''} onChange={(e) => onUpdate(id, 'params.queue', e.target.value)} placeholder="Номер очереди" />
          <input className={styles.inputXs} value={p.timeout || ''} onChange={(e) => onUpdate(id, 'params.timeout', e.target.value)} placeholder="сек" />
          <input className={styles.inputXs} value={p.options || ''} onChange={(e) => onUpdate(id, 'params.options', e.target.value)} placeholder="thH" />
        </div>
      );
    case 'toivr':
      return <input className={styles.inputMd} value={p.ivr_uid || ''} onChange={(e) => onUpdate(id, 'params.ivr_uid', e.target.value)} placeholder="IVR ID" />;
    case 'togroup':
      return <input className={styles.inputMd} value={p.group || ''} onChange={(e) => onUpdate(id, 'params.group', e.target.value)} placeholder="Номер группы" />;
    case 'tolist':
      return (
        <div className={styles.params}>
          <input className={styles.inputMd} value={p.numbers || ''} onChange={(e) => onUpdate(id, 'params.numbers', e.target.value)} placeholder="100,101,102" />
          <input className={styles.inputXs} value={p.timeout || ''} onChange={(e) => onUpdate(id, 'params.timeout', e.target.value)} placeholder="сек" />
        </div>
      );
    case 'toroute':
      return (
        <div className={styles.params}>
          <input className={styles.inputSm} value={p.context || ''} onChange={(e) => onUpdate(id, 'params.context', e.target.value)} placeholder="Контекст" />
          <input className={styles.inputSm} value={p.extension || ''} onChange={(e) => onUpdate(id, 'params.extension', e.target.value)} placeholder="Правило набора" />
        </div>
      );
    case 'playprompt':
    case 'playback':
      return <input className={styles.inputMd} value={p.file || ''} onChange={(e) => onUpdate(id, 'params.file', e.target.value)} placeholder="Имя файла записи" />;
    case 'setclid_custom':
      return <input className={styles.inputMd} value={p.callerid || ''} onChange={(e) => onUpdate(id, 'params.callerid', e.target.value)} placeholder="CallerID" />;
    case 'setclid_list':
      return <input className={styles.inputMd} value={p.list_uid || ''} onChange={(e) => onUpdate(id, 'params.list_uid', e.target.value)} placeholder="ID списка" />;
    case 'sendmail':
      return (
        <div className={styles.params}>
          <input className={styles.inputSm} value={p.email || ''} onChange={(e) => onUpdate(id, 'params.email', e.target.value)} placeholder="email@example.com" />
          <input className={styles.inputMd} value={p.text || ''} onChange={(e) => onUpdate(id, 'params.text', e.target.value)} placeholder="Текст сообщения..." />
        </div>
      );
    case 'telegram':
      return (
        <div className={styles.params}>
          <input className={styles.inputSm} value={p.chat_id || ''} onChange={(e) => onUpdate(id, 'params.chat_id', e.target.value)} placeholder="Chat ID / @channel" />
          <input className={styles.inputMd} value={p.text || ''} onChange={(e) => onUpdate(id, 'params.text', e.target.value)} placeholder="Текст..." />
        </div>
      );
    case 'voicemail':
    case 'sendmailpeer':
      return <input className={styles.inputMd} value={p.exten || ''} onChange={(e) => onUpdate(id, 'params.exten', e.target.value)} placeholder="Номер абонента" />;
    case 'text2speech':
      return <input className={styles.inputMd} value={p.text || ''} onChange={(e) => onUpdate(id, 'params.text', e.target.value)} placeholder="Текст для синтеза..." />;
    case 'asr':
    case 'keywords':
      return (
        <div className={styles.params}>
          <input className={styles.inputXs} value={p.silence_timeout || ''} onChange={(e) => onUpdate(id, 'params.silence_timeout', e.target.value)} placeholder="Тишина (сек)" />
          <input className={styles.inputXs} value={p.max_timer || ''} onChange={(e) => onUpdate(id, 'params.max_timer', e.target.value)} placeholder="Запись (сек)" />
        </div>
      );
    case 'webhook':
      return <input className={styles.inputMd} value={p.url || ''} onChange={(e) => onUpdate(id, 'params.url', e.target.value)} placeholder="https://..." />;
    case 'confbridge':
      return <input className={styles.inputSm} value={p.room || ''} onChange={(e) => onUpdate(id, 'params.room', e.target.value)} placeholder="Комната" />;
    case 'cmd':
      return <input className={styles.inputLg} value={p.command || ''} onChange={(e) => onUpdate(id, 'params.command', e.target.value)} placeholder="Команда dialplan Asterisk..." />;
    case 'tofax':
      return <input className={styles.inputMd} value={p.email || ''} onChange={(e) => onUpdate(id, 'params.email', e.target.value)} placeholder="email доставки факса" />;
    case 'label':
      return <input className={styles.inputMd} value={p.label_name || ''} onChange={(e) => onUpdate(id, 'params.label_name', e.target.value)} placeholder="Имя метки" />;
    case 'busy':
      return <input className={styles.inputXs} value={p.timeout || ''} onChange={(e) => onUpdate(id, 'params.timeout', e.target.value)} placeholder="сек" />;
    case 'hangup':
    default:
      return <span className={styles.noParams}>—</span>;
  }
}
