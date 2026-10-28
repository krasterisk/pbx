import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tooltip,
} from '@/shared/ui';
import { CallCenterSettings } from '../CallCenterSettings';
import type { PersonalSettingsTab } from '../CallCenterSettings/CallCenterSettings';
import type { AgentHotkeyMap } from '@krasterisk/shared';
import styles from './AgentPersonalSettings.module.scss';

export function AgentSettingsTrigger({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const label = t('callcenter.agent.personalSettings', 'My settings');
  return (
    <Tooltip content={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        data-testid="agent-personal-settings-trigger"
        onClick={onClick}
      >
        <Settings size={17} aria-hidden />
      </Button>
    </Tooltip>
  );
}

/**
 * Personal settings of the operator (panel visibility, KPI period, notifications) as a Sheet
 * opened from the workspace header (U5.3). Does not require access to the call-center settings page.
 */
export function AgentPersonalSettings({
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
  tab,
  onTabChange,
  hotkeyMap,
  sip,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  tab?: PersonalSettingsTab;
  onTabChange?: (tab: PersonalSettingsTab) => void;
  hotkeyMap?: Readonly<AgentHotkeyMap>;
  sip?: boolean;
} = {}) {
  const { t } = useTranslation();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => {
    setLocalOpen(value);
    onOpenChange?.(value);
  };
  const label = t('callcenter.agent.personalSettings', 'My settings');

  return (
    <>
      {!hideTrigger && <AgentSettingsTrigger onClick={() => setOpen(true)} />}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={styles.sheet}
          data-testid="agent-personal-settings-sheet"
        >
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <div className={styles.body}>
            <CallCenterSettings
              tab={tab}
              onTabChange={onTabChange}
              hotkeyMap={hotkeyMap}
              sip={sip}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
