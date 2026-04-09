import { PeerType, PeerStatus } from '../enums';

export interface IPeer {
  uid: number;
  name: string;
  fullname: string;
  exten: string;
  secret: string;
  peer_type: PeerType;
  context: string;
  active: number;
  callerid: string;
  transport: string;
  email: string;
  mobile: string;
  dtmfmode: string;
  nat: string;
  callgroup: string;
  pickupgroup: string;
  'call-limit': string;
  videosupport: string;
  qualify: string;
  allow_ip: string;
  allow_redirect: number;
  comment: string;
  department: string;
  ap_enable: number;
  mac: string;
  ipei: string;
  mac_prefix: string;
  ap_template: string;
  pv_vars: string;
  lb_noshow: number;
  useragent: string;
  ipaddr: string;
  vpbx_user_uid: number;
}

export interface IPeerListItem {
  uid: number;
  exten: string;
  fullname: string;
  peer_type: PeerType;
  department: string;
  comment: string;
  active: boolean;
  status: PeerStatus;
  ip: string;
  mac: string;
  pickupgroup: string;
  allow_redirect: boolean;
  ap_enable: boolean;
}

export interface ICreatePeer {
  name: string;
  exten: string;
  password: string;
  peer_type: PeerType;
  context: string;
  active?: boolean;
  callerid?: string;
  department?: string;
  comment?: string;
  transport?: string;
  dtmfmode?: string;
  nat?: string;
  callgroup?: string;
  pickupgroup?: string;
  email?: string;
  mobile?: string;
  allow_redirect?: boolean;
}

export interface IUpdatePeer extends Partial<ICreatePeer> {}
