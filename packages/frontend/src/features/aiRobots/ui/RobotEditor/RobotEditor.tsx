import { ModalBody } from '@/shared/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { AI_VOICE_ROBOT_DEFAULTS, validateAiVoiceConfig, type AiVoiceRobot, type AiVoiceConfigIssue } from '@krasterisk/shared';
import { Button, Dialog, FormDialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Text } from '@/shared/ui';
import { useSaveAiVoiceRobotMutation } from '@/shared/api/endpoints/aiVoiceRobotsApi';
import { RobotSettingsForm } from '../RobotSettingsForm';
import cls from './RobotEditor.module.scss';

export function RobotEditor({ robot, copy = false, onClose }: { robot?: AiVoiceRobot; copy?: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [config, setConfig] = useState(() => ({ ...structuredClone(robot?.config ?? AI_VOICE_ROBOT_DEFAULTS),
    ...(copy ? { name: '', uniqueId: '' } : {}) }));
  const [issues, setIssues] = useState<AiVoiceConfigIssue[]>([]);
  const [initial] = useState(() => JSON.stringify(config));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState('');
  const [save, { isLoading }] = useSaveAiVoiceRobotMutation();
  const requestClose = () => {
    if (isLoading) return;
    if (JSON.stringify(config) !== initial) setConfirmDiscard(true);
    else onClose();
  };
  const submit = async () => {
    const nextIssues = validateAiVoiceConfig(config);
    setIssues(nextIssues);
    if (nextIssues.length) return;
    setError('');
    try {
      await save({ uid: copy ? undefined : robot?.uid, revision: robot?.revision, config }).unwrap();
      toast.success(t('aiVoiceDesigner.saved'));
      onClose();
    } catch (failure) {
      const stale = typeof failure === 'object' && failure !== null && 'status' in failure && failure.status === 409;
      const data = typeof failure === 'object' && failure !== null && 'data' in failure ? failure.data : null;
      const code = typeof data === 'object' && data !== null && 'code' in data ? data.code : undefined;
      if (code === 'identifier_in_use') {
        setIssues([{ field: 'uniqueId', code: 'identifierInUse' }]);
      } else {
        setError(t(`aiVoiceDesigner.${code === 'provider_unavailable' ? 'providerUnavailable'
          : code === 'binding_not_found' ? 'bindingUnavailable' : stale ? 'stale' : 'saveFailed'}`));
      }
    }
  };
  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <FormDialogContent size="large" className={cls.dialog}>
      <DialogHeader className={cls.header}>
        <DialogTitle>{t(`aiVoiceDesigner.${copy ? 'copy' : robot ? 'edit' : 'create'}`)}</DialogTitle>
        <DialogDescription>{t('aiVoiceDesigner.saveHint')}</DialogDescription>
      </DialogHeader>
      <ModalBody className={cls.body}>
        {error ? <Text role="alert" variant="error">{error}</Text> : null}
        <RobotSettingsForm value={config} issues={issues} disabled={isLoading}
          onChange={next => { setConfig(next); setIssues([]); }} />
      </ModalBody>
      <DialogFooter className={cls.footer}>
        {confirmDiscard ? <>
          <Text role="alert">{t('aiVoiceDesigner.unsaved')}</Text>
          <Button variant="outline" onClick={() => setConfirmDiscard(false)}>{t('aiVoiceDesigner.keepEditing')}</Button>
          <Button onClick={onClose}>{t('aiVoiceDesigner.discard')}</Button>
        </> : <>
          <Button variant="outline" disabled={isLoading} onClick={requestClose}>{t('common.cancel')}</Button>
          <Button disabled={isLoading} onClick={() => void submit()}>{t(isLoading ? 'common.saving' : 'common.save')}</Button>
        </>}
      </DialogFooter>
    </FormDialogContent>
  </Dialog>;
}
