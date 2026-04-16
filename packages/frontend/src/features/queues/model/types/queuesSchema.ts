export interface IQueueMember {
  uniqueid?: number;
  membername: string;
  queue_name: string;
  interface: string;
  penalty: number;
  paused: number;
  wrapuptime?: number;
  state_interface?: string;
}

export interface IQueue {
  name: string;
  exten?: string;
  display_name?: string;
  musiconhold?: string;
  announce?: string;
  context?: string;
  timeout?: number;
  strategy?: string;
  retry?: number;
  wrapuptime?: number;
  maxlen?: number;
  servicelevel?: number;
  weight?: number;
  joinempty?: string;
  leavewhenempty?: string;
  ringinuse?: boolean;
  // Announcements
  announce_frequency?: number;
  announce_holdtime?: string;
  announce_round_seconds?: number;
  periodic_announce?: string;
  periodic_announce_frequency?: number;
  queue_youarenext?: string;
  queue_thereare?: string;
  queue_callswaiting?: string;
  queue_holdtime?: string;
  queue_minutes?: string;
  queue_seconds?: string;
  queue_lessthan?: string;
  queue_thankyou?: string;
  queue_reporthold?: string;
  // Meta
  memberCount?: number;
}

export interface IQueueFull extends IQueue {
  members: IQueueMember[];
  [key: string]: any; // advanced fields
}

export interface QueuesPageSchema {
  isModalOpen: boolean;
  modalMode: 'create' | 'edit';
  selectedQueueName: string | null;
}
