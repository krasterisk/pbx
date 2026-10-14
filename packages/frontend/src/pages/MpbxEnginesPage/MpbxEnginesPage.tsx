import { useTranslation } from 'react-i18next';
import { Button, Text, HStack, VStack } from '@/shared/ui';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { SttEnginesTable, sttEnginesActions } from '@/features/stt-engines';
import { TtsEnginesTable, ttsEnginesActions } from '@/features/tts-engines';

/** The v3 module retains independent legacy engines, without the v4 provider catalog. */
export function MpbxEnginesPage({ kind }: { kind: 'stt' | 'tts' }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const key = kind === 'stt' ? 'sttEngines' : 'ttsEngines';
  return <VStack max gap="24"><HStack max justify="between">
    <Text as="h1" variant="h1">{t(`${key}.title`)}</Text>
    <Button onClick={() => dispatch(kind === 'stt' ? sttEnginesActions.openCreateModal() : ttsEnginesActions.openCreateModal())}>
      {t(`${key}.add`)}
    </Button>
  </HStack>{kind === 'stt' ? <SttEnginesTable /> : <TtsEnginesTable />}</VStack>;
}
