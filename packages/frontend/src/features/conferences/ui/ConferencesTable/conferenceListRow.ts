import type {
  ConferenceEntryStrictness,
  ConferenceParticipant,
  ConferenceRecordMode,
  ConferenceRoomCatalogItem,
  ConferenceRoomKind,
} from '@/shared/api/endpoints/conferenceRoomApi';

/** List row: catalog identity plus optional fields GET /conferences already returns. */
export type ConferenceListRow = ConferenceRoomCatalogItem & {
  kind?: ConferenceRoomKind;
  entry_strictness?: ConferenceEntryStrictness;
  record_mode?: ConferenceRecordMode;
  participants?: ConferenceParticipant[];
  recording?: boolean;
};
