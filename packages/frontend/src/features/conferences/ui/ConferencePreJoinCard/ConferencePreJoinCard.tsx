import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Input,
  Label,
  PasswordInput,
  Select,
  Text,
} from '@/shared/ui';
import { Loader } from '@/shared/ui/Loader';
import { Flex, VStack } from '@/shared/ui/Stack';
import { VideoSurface } from '@/shared/ui/VideoSurface';
import {
  audioDeviceLabel,
  useAudioDevices,
} from '@/features/callcenter/lib/useAudioDevices';
import cls from './ConferencePreJoinCard.module.scss';

const NAME_MAX = 64;
const PIN_ERROR_ID = 'guest-pin-error';
const NAME_ERROR_ID = 'guest-name-error';

const LINK_INVALID_CODES = new Set([
  'CONFERENCE_GUEST_TOKEN_REVOKED',
  'CONFERENCE_GUEST_TOKEN_EXPIRED',
  'CONFERENCE_GUEST_TOKEN_INVALID',
]);

export interface ConferencePreJoinCardProps {
  requiresPin?: boolean;
  joining?: boolean;
  waitingForModerator?: boolean;
  mediaDenied?: boolean;
  previewStream?: MediaStream | null;
  error?: unknown;
  onJoin: (payload: { displayName: string; pin?: string }) => void;
  onLeave?: () => void;
}

function readJoinError(error: unknown): { status?: number; code?: string } {
  if (!error || typeof error !== 'object') return {};
  const row = error as { status?: number; code?: string; data?: { code?: string } };
  return {
    status: typeof row.status === 'number' ? row.status : undefined,
    code: typeof row.code === 'string' ? row.code : row.data?.code,
  };
}

function screenKind(
  error: unknown,
  mediaDenied: boolean,
): 'linkInvalid' | 'full' | 'mediaDenied' | null {
  if (mediaDenied) return 'mediaDenied';
  const { status, code } = readJoinError(error);
  if (code === 'CONFERENCE_ROOM_FULL') return 'full';
  if (status === 401 || (code && LINK_INVALID_CODES.has(code))) return 'linkInvalid';
  return null;
}

export function ConferencePreJoinCard({
  requiresPin = false,
  joining = false,
  waitingForModerator = false,
  mediaDenied = false,
  previewStream = null,
  error,
  onJoin,
  onLeave,
}: ConferencePreJoinCardProps) {
  const { t } = useTranslation();
  const audioDevices = useAudioDevices();
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState('default');
  const [localNameError, setLocalNameError] = useState(false);
  const [localMediaDenied, setLocalMediaDenied] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { code } = readJoinError(error);
  const showPin = requiresPin || code === 'CONFERENCE_PIN_REQUIRED' || code === 'CONFERENCE_PIN_WRONG';
  const pinWrong = code === 'CONFERENCE_PIN_WRONG';
  const nameRequired = localNameError || code === 'CONFERENCE_DISPLAY_NAME_REQUIRED';
  const denied = mediaDenied || localMediaDenied;
  const screen = screenKind(error, denied);
  const busy = joining || previewLoading || waitingForModerator;
  const joinLabel = t('conferences.guest.join', 'Присоединиться к конференции');

  useEffect(() => {
    let cancelled = false;
    const enumerate = navigator.mediaDevices?.enumerateDevices;
    if (!enumerate) return undefined;
    void enumerate.call(navigator.mediaDevices).then((devices) => {
      if (!cancelled) setCameras(devices.filter((d) => d.kind === 'videoinput'));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleJoin = async () => {
    if (busy) return;
    const name = displayName.trim().slice(0, NAME_MAX);
    if (!name) {
      setLocalNameError(true);
      return;
    }
    setLocalNameError(false);
    setPreviewLoading(true);
    try {
      if (!previewStream && navigator.mediaDevices?.getUserMedia) {
        try {
          await navigator.mediaDevices.getUserMedia({
            audio: audioDevices.selectedMic === 'default'
              ? true
              : { deviceId: { exact: audioDevices.selectedMic } },
            video: selectedCam === 'default' ? true : { deviceId: { exact: selectedCam } },
          });
        } catch {
          setLocalMediaDenied(true);
          return;
        }
      }
      onJoin({ displayName: name, pin: showPin && pin ? pin : undefined });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (screen === 'linkInvalid') {
    return (
      <Card className={cls.card} data-testid="conference-prejoin-card">
        <VStack gap="12" align="center">
          <Text variant="h4">{t('conferences.guest.linkInvalid', 'Ссылка недействительна или истекла')}</Text>
          <Text variant="muted">
            {t('conferences.guest.linkInvalidHint', 'Попросите организатора отправить новое приглашение.')}
          </Text>
        </VStack>
      </Card>
    );
  }

  if (screen === 'full') {
    return (
      <Card className={cls.card} data-testid="conference-prejoin-card" aria-live="assertive">
        <VStack gap="12" align="center">
          <Text variant="h4">{t('conferences.live.full', 'В комнате нет свободных мест')}</Text>
          <Text variant="muted">
            {t(
              'conferences.live.fullHint',
              'Попробуйте подключиться позже или попросите организатора освободить место.',
            )}
          </Text>
        </VStack>
      </Card>
    );
  }

  if (screen === 'mediaDenied') {
    return (
      <Card className={cls.card} data-testid="conference-prejoin-card">
        <VStack gap="12" align="center">
          <Text variant="h4">{t('conferences.live.mediaDenied', 'Браузер не дал доступ к микрофону')}</Text>
          <Text variant="muted">
            {t(
              'conferences.live.mediaDeniedHint',
              'Разрешите доступ к микрофону и камере в настройках сайта, затем обновите страницу.',
            )}
          </Text>
        </VStack>
      </Card>
    );
  }

  return (
    <Card className={cls.card} data-testid="conference-prejoin-card">
      <VStack gap="16" max>
        <Text variant="h4">{t('conferences.guest.title', 'Вход в конференцию')}</Text>
        <Flex className={cls.preview} align="center" justify="center">
          {previewStream ? (
            <VideoSurface stream={previewStream} muted mirrored className={cls.previewVideo} />
          ) : (
            <VStack align="center" gap="8">
              <Avatar name={displayName || '?'} />
              <Text variant="small">{t('conferences.live.camOff', 'Камера выключена')}</Text>
            </VStack>
          )}
        </Flex>
        {waitingForModerator ? (
          <VStack align="center" gap="8">
            <Loader size={32} />
            <Text>{t('conferences.guest.lobby', 'Ждём одобрения модератора')}</Text>
            <Text variant="muted">
              {t(
                'conferences.guest.lobbyHint',
                'Не закрывайте страницу. Мы подключим вас, как только модератор разрешит вход.',
              )}
            </Text>
          </VStack>
        ) : null}
        <VStack gap="6" max>
          <Label htmlFor="guest-display-name">
            {t('conferences.guest.nameField', 'Как вас представить')}
          </Label>
          <Input
            id="guest-display-name"
            value={displayName}
            maxLength={NAME_MAX}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('conferences.guest.namePlaceholder', 'Иван Петров')}
            aria-invalid={nameRequired || undefined}
            aria-describedby={nameRequired ? NAME_ERROR_ID : undefined}
          />
          {nameRequired ? (
            <Text id={NAME_ERROR_ID} variant="error">
              {t('conferences.guest.nameRequired', 'Укажите имя')}
            </Text>
          ) : (
            <Text variant="muted">
              {t('conferences.guest.namePlaceholderHint', 'Это имя увидят участники встречи.')}
            </Text>
          )}
        </VStack>
        {showPin ? (
          <VStack gap="6" max>
            <Label htmlFor="guest-pin">{t('conferences.guest.pinField', 'PIN комнаты')}</Label>
            <PasswordInput
              id="guest-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
              aria-invalid={pinWrong || undefined}
              aria-describedby={pinWrong ? PIN_ERROR_ID : undefined}
            />
            {pinWrong ? (
              <Text id={PIN_ERROR_ID} variant="error">
                {t('conferences.guest.pinWrong', 'Неверный PIN комнаты')}
              </Text>
            ) : null}
          </VStack>
        ) : null}
        <VStack gap="6" max>
          <Label htmlFor="guest-mic">{t('conferences.guest.micDevice', 'Микрофон')}</Label>
          <Select
            id="guest-mic"
            value={audioDevices.selectedMic}
            onChange={(e) => audioDevices.setSelectedMic(e.target.value)}
            aria-label={t('conferences.guest.micDevice', 'Микрофон')}
          >
            <option value="default">Default</option>
            {audioDevices.microphones.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {audioDeviceLabel(d, i, 'mic')}
              </option>
            ))}
          </Select>
        </VStack>
        <VStack gap="6" max>
          <Label htmlFor="guest-cam">{t('conferences.guest.camDevice', 'Камера')}</Label>
          <Select
            id="guest-cam"
            value={selectedCam}
            onChange={(e) => setSelectedCam(e.target.value)}
            aria-label={t('conferences.guest.camDevice', 'Камера')}
          >
            <option value="default">Default</option>
            {cameras.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label?.trim() || `Camera ${i + 1}`}
              </option>
            ))}
          </Select>
        </VStack>
        <Button
          type="button"
          className={cls.joinCta}
          disabled={busy}
          onClick={() => {
            void handleJoin();
          }}
        >
          {busy ? <Loader2 size={20} aria-hidden /> : null}
          {joinLabel}
        </Button>
        {waitingForModerator && onLeave ? (
          <Button type="button" variant="outline" onClick={onLeave}>
            {t('conferences.guest.leave', 'Покинуть конференцию')}
          </Button>
        ) : null}
      </VStack>
    </Card>
  );
}
