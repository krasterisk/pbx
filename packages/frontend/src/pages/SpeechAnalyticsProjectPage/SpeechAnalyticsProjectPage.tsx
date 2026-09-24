import { memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dialog, DialogContent } from '@/shared/ui';
import { ProjectSettingsForm } from '@/features/speechAnalytics/ui/ProjectSettingsForm/ProjectSettingsForm';
import cls from './SpeechAnalyticsProjectPage.module.scss';

export type SpeechAnalyticsProjectPageProps = {
  /** Kept so existing callers compile. Model overrides stay on the published config. */
  canEditModels?: boolean;
};

export const SpeechAnalyticsProjectPage = memo(({
  canEditModels: _canEditModels = false,
}: SpeechAnalyticsProjectPageProps) => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const close = () => navigate('/speech-analytics/projects');

  return (
    <div data-testid="speech-analytics-project">
      <Dialog open={Boolean(id)} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent size="large" className={cls.dialog}>
          {id ? <ProjectSettingsForm projectId={id} onSaved={close} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
});

SpeechAnalyticsProjectPage.displayName = 'SpeechAnalyticsProjectPage';
