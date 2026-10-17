import { useTranslation } from 'react-i18next';
import {
  AGENT_HOTKEY_ACTIONS,
  DEFAULT_AGENT_HOTKEYS,
  describeHotkey,
  type AgentHotkeyMap,
} from '@krasterisk/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Flex, Text, VStack } from '@/shared/ui';
import styles from './HotkeysHelp.module.scss';

export interface HotkeysHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  map?: Readonly<AgentHotkeyMap>;
  sip?: boolean;
}

/** Cheat sheet of the agent hotkeys, opened with "?" or from the header (U2.4). */
export function HotkeysHelp({ open, onOpenChange, map, sip = false }: HotkeysHelpProps) {
  const { t } = useTranslation();
  const effective = map ?? DEFAULT_AGENT_HOTKEYS;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" data-testid="cc-hotkeys-help">
        <DialogHeader>
          <DialogTitle>{t('callcenter.settings.hotkeys.helpTitle', 'Hotkeys')}</DialogTitle>
        </DialogHeader>
        <VStack gap="8">
          {AGENT_HOTKEY_ACTIONS.map((action) => (
            <Flex key={action} justify="between" align="center" gap="12" className={styles.row}>
              <Text>{t(`callcenter.settings.hotkeys.action.${action}`, action)}</Text>
              <Text as="span" className={styles.kbd}>{sip && ['answer', 'mute', 'hold'].includes(action)
                ? t('callcenter.settings.hotkeys.onDevice', 'On SIP phone')
                : describeHotkey(effective[action])}</Text>
            </Flex>
          ))}
          <Text variant="muted" className={styles.hint}>
            {t('callcenter.settings.hotkeys.helpHint', 'They work in the Russian layout too and do not fire while you type in a field.')}
          </Text>
        </VStack>
      </DialogContent>
    </Dialog>
  );
}
