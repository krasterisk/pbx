import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './RawDialplanEditor.module.scss';

interface RawDialplanEditorProps {
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}

export const RawDialplanEditor = memo(({ value, onChange, readonly }: RawDialplanEditorProps) => {
  const { t } = useTranslation();

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
          {value.split('\n').map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          className={styles.editor}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readonly}
          spellCheck={false}
          placeholder={`; Example dialplan\nexten => _X.,1,NoOp()\nsame => n,Dial(PJSIP/\${EXTEN},30,tT)\nsame => n,Hangup()`}
        />
      </div>
    </div>
  );
});

RawDialplanEditor.displayName = 'RawDialplanEditor';
