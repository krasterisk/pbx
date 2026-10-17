import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, Tooltip } from '@/shared/ui';
import { CallCenterSettings } from '../CallCenterSettings';

/**
 * Personal settings of the operator (panel visibility, KPI period, notifications) as a Sheet
 * opened from the workspace header (U5.3). Does not require access to the call-center settings page.
 */
export function AgentPersonalSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t('callcenter.agent.personalSettings', 'My settings');

  return (
    <>
      <Tooltip content={label}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={label}
          data-testid="agent-personal-settings-trigger"
          onClick={() => setOpen(true)}
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </Button>
      </Tooltip>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent data-testid="agent-personal-settings-sheet">
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <CallCenterSettings />
        </SheetContent>
      </Sheet>
    </>
  );
}
