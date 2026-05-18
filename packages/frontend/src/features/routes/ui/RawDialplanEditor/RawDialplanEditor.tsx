import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureCdrVpbxUserUidInDialplan } from '@krasterisk/shared';
import styles from './RawDialplanEditor.module.scss';

interface RawDialplanEditorProps {
  value: string;
  onChange: (value: string) => void;
  vpbxUserUid: number;
  readonly?: boolean;
}

export const RawDialplanEditor = memo(({ value, onChange, vpbxUserUid, readonly }: RawDialplanEditorProps) => {
  const { t } = useTranslation();

  const applyTenantUid = useCallback(
    (text: string) => ensureCdrVpbxUserUidInDialplan(text, vpbxUserUid),
    [vpbxUserUid],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(applyTenantUid(e.target.value));
    },
    [onChange, applyTenantUid],
  );

  const displayValue = applyTenantUid(value);

  const placeholder = [
    '; Asterisk dialplan',
    'exten => _X.,1,NoOp()',
    `same => n,Set(CDR(vpbx_user_uid)=${vpbxUserUid})`,
    'same => n,Set(__HH_ROUTE_UID=${ROUTE_UID})',
    'same => n,Dial(PJSIP/${EXTEN},30,tT)',
    'same => n,Hangup()',
  ].join('\n');

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.title}>
          {t('routes.rawDialplan', 'Asterisk Dialplan')}
        </span>
        <span className={styles.hint}>
          {t('routes.rawDialplanHint', 'Синтаксис extensions.conf')}
        </span>
      </div>
      <div className={styles.editorWrap}>
        <div className={styles.lineNumbers}>
          {displayValue.split('\n').map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          className={styles.editor}
          value={displayValue}
          onChange={handleChange}
          readOnly={readonly}
          spellCheck={false}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
});

RawDialplanEditor.displayName = 'RawDialplanEditor';
