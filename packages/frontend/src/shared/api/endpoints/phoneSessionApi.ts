import { rtkApi } from '../rtkApi';

export interface PhoneEndpoint { id: string; extension: string; name: string; webrtc: boolean; available: boolean; sipAvailable?: boolean }
export interface PhoneConnection { endpoint: string; extension: string; mode: 'sip' | 'webrtc'; expiresAt: number }
export interface PhoneCredentials { username: string; password: string; domain: string }
export interface PhoneContact { id: string; name: string; number: string; kind: 'employee' | 'contact' }

export const phoneSessionApi = rtkApi.injectEndpoints({
  endpoints: (build) => ({
    phoneContacts: build.query<{ rows: PhoneContact[]; truncated: boolean }, { identity: string; search: string }>({
      query: ({search}) => `/phone-session/contacts?${new URLSearchParams({search})}`, keepUnusedDataFor: 0,
    }),
    // Identity is a cache partition only. The server always derives access scope from JWT.
    phoneEndpoints: build.query<{ availabilityKnown?: boolean; callCenterActive: boolean; callCenterPhone?: { mode: 'sip' | 'webrtc'; extension: string } | null; endpoints: PhoneEndpoint[] }, string>({
      query: () => '/phone-session/endpoints',
    }),
    connectPhone: build.mutation<PhoneConnection, { endpoint: string; mode: 'sip' | 'webrtc'; owner: string }>({
      query: (body) => ({ url: '/phone-session', method: 'POST', body }),
    }),
    phoneHeartbeat: build.mutation<PhoneConnection, { owner: string }>({
      query: (body) => ({ url: '/phone-session/heartbeat', method: 'POST', body }),
    }),
    restorePhone: build.mutation<PhoneConnection | null, {owner:string}>({
      query: body => ({url:'/phone-session/restore',method:'POST',body}),
    }),
    disconnectPhone: build.mutation<{ success: true }, { owner: string }>({
      query: (body) => ({ url: '/phone-session', method: 'DELETE', body }),
    }),
    phoneCredentials: build.mutation<{ credentials: PhoneCredentials; wssUrl: string | null; iceServers: RTCIceServer[] }, { owner: string }>({
      query: (body) => ({ url: '/phone-session/runtime', method: 'POST', body }),
    }),
    phoneDial: build.mutation<{ success: true; mode: 'sip' | 'webrtc'; target: string }, { owner: string; number: string }>({
      query: (body) => ({ url: '/phone-session/dial', method: 'POST', body }),
    }),
    phoneDialViaCallCenter: build.mutation<{ success: boolean; mode: 'pjsip' | 'webrtc'; target: string }, { target: string }>({
      query: (body) => ({ url: '/callcenter/agent/click-to-call', method: 'POST', body }),
    }),
  }),
});
export const { useRestorePhoneMutation, usePhoneContactsQuery, usePhoneEndpointsQuery, useConnectPhoneMutation, usePhoneHeartbeatMutation, useDisconnectPhoneMutation,
  usePhoneCredentialsMutation, usePhoneDialMutation, usePhoneDialViaCallCenterMutation } = phoneSessionApi;
