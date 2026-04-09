export interface IQueue {
  uid: number;
  name: string;
  exten: string;
  strategy: string;
  timeout: number;
  wrapuptime: number;
  maxlen: number;
  announce_frequency: number;
  periodic_announce: string;
  joinempty: string;
  leavewhenempty: string;
  ringinuse: string;
  musicclass: string;
  user_uid: number;
}

export interface IQueueMember {
  interface: string;
  name: string;
  penalty: number;
  paused: boolean;
  callsTaken: number;
  lastCall: number;
  status: number;
}

export interface IQueueSummary {
  queue: string;
  loggedIn: number;
  available: number;
  callers: number;
  holdtime: number;
  talktime: number;
  completed: number;
  abandoned: number;
  serviceLevelPerf: number;
}

export interface ICreateQueue {
  name: string;
  exten: string;
  strategy?: string;
  timeout?: number;
  wrapuptime?: number;
  maxlen?: number;
}

export interface IUpdateQueue extends Partial<ICreateQueue> {}
