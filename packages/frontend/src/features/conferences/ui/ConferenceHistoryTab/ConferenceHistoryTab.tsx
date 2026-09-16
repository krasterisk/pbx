import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import {
  conferenceMeetingPlayUrl,
  useGetConferenceMeetingsQuery,
  type ConferenceMeeting,
} from '@/shared/api/endpoints/conferenceMeetingsApi';
import { getAuthApiBase } from '@/shared/api/apiBase';
import { Text } from '@/shared/ui';
import { AudioPlayer } from '@/shared/ui/AudioPlayer';
import { HStack, VStack } from '@/shared/ui/Stack';
import cls from './ConferenceHistoryTab.module.scss';

export interface ConferenceHistoryTabProps {
  roomUid: number;
}

function jwtPlaySrc(roomUid: number, meetingUid: number): string {
  const path = conferenceMeetingPlayUrl(roomUid, meetingUid);
  const base = getAuthApiBase();
  let url = `${base}${path}`;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) {
    url += `${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }
  return url;
}

function formatStartedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function formatDuration(startedAt: string, endedAt: string): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '';
  const totalSec = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function hasPlayableRecording(meeting: ConferenceMeeting): boolean {
  return Boolean(meeting.recording_file_rel);
}

export function ConferenceHistoryTab({ roomUid }: ConferenceHistoryTabProps) {
  const { t } = useTranslation();
  const { data: meetings } = useGetConferenceMeetingsQuery(roomUid);
  const [openUid, setOpenUid] = useState<number | null>(null);
  const rows = meetings ?? [];

  if (rows.length === 0) {
    return (
      <VStack gap="12" max className={cls.root}>
        <Text className={cls.empty}>
          {t('conferences.history.empty', 'Нет встреч')}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap="8" max className={cls.root}>
      {rows.map((meeting) => {
        const expanded = openUid === meeting.uid;
        const duration = meeting.ended_at
          ? formatDuration(meeting.started_at, meeting.ended_at)
          : t('conferences.history.ongoing', '-');
        const playSrc = hasPlayableRecording(meeting)
          ? jwtPlaySrc(meeting.room_uid, meeting.uid)
          : '';
        const detailsId = `conference-history-${meeting.uid}`;

        return (
          <VStack key={meeting.uid} gap="8" max className={cls.row}>
            <HStack
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              aria-controls={detailsId}
              gap="8"
              align="center"
              justify="between"
              max
              className={cls.toggle}
              onClick={() => setOpenUid(expanded ? null : meeting.uid)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setOpenUid(expanded ? null : meeting.uid);
                }
              }}
            >
              <HStack gap="8" align="center" wrap="wrap" className={cls.meta}>
                <Text as="span" className={cls.date}>
                  {formatStartedAt(meeting.started_at)}
                </Text>
                <Text as="span" className={cls.duration}>
                  {duration}
                </Text>
                <Text as="span" className={cls.count}>
                  {t('conferences.history.participants', 'Участники')}
                  {': '}
                  {meeting.participants.length}
                </Text>
                {meeting.has_recording || meeting.recording_file_rel ? (
                  <Text as="span" className={cls.recorded}>
                    {t('conferences.history.recorded', 'Есть запись')}
                  </Text>
                ) : null}
              </HStack>
              <ChevronDown
                size={16}
                className={expanded ? cls.chevronOpen : cls.chevron}
              />
            </HStack>

            {expanded ? (
              <VStack gap="8" max className={cls.details} id={detailsId}>
                {meeting.participants.map((participant, index) => (
                  <HStack
                    key={`${participant.display_name}-${participant.role}-${index}`}
                    gap="8"
                    align="center"
                    className={cls.participant}
                  >
                    <Text as="span">{participant.display_name}</Text>
                    <Text as="span" className={cls.role}>
                      {participant.role}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            ) : null}

            {playSrc ? (
              <VStack
                gap="8"
                max
                className={cls.player}
                data-testid="conference-history-player"
                data-src={playSrc}
              >
                <AudioPlayer src={playSrc} />
              </VStack>
            ) : null}
          </VStack>
        );
      })}
    </VStack>
  );
}
