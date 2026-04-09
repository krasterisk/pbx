import { CallDisposition } from '../enums';

export interface ICdr {
  id: number;
  calldate: string;
  clid: string;
  src: string;
  dst: string;
  dcontext: string;
  channel: string;
  dstchannel: string;
  lastapp: string;
  lastdata: string;
  duration: number;
  billsec: number;
  disposition: CallDisposition;
  amaflags: number;
  accountcode: string;
  uniqueid: string;
  userfield: string;
  recordingfile: string;
}

export interface ICdrFilter {
  dateFrom: string;
  dateTo: string;
  src?: string;
  dst?: string;
  disposition?: CallDisposition;
  minDuration?: number;
  maxDuration?: number;
}

export interface ICdrStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  busyCalls: number;
  failedCalls: number;
  totalDuration: number;
  avgDuration: number;
}
