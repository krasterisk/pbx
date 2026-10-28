import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Settings2, RefreshCw, HelpCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { PhoneActionsProvider, dialableNumber, useOperatorPhone } from '@/entities/phone';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { useWebRTCPhone } from '@/shared/lib/telephony/useWebRTCPhone';
import { usePhoneEndpointsQuery, useConnectPhoneMutation, useDisconnectPhoneMutation, usePhoneHeartbeatMutation,
  useRestorePhoneMutation, usePhoneCredentialsMutation, usePhoneDialMutation, usePhoneDialViaCallCenterMutation, type PhoneConnection } from '@/shared/api/endpoints/phoneSessionApi';
import { Button, Input, Flex, VStack, HStack, Text, Label, Select, Tooltip } from '@/shared/ui';
import { SoftphoneWidget } from '@/shared/ui/SoftphoneWidget';
import { PhoneJournal, PhoneContacts } from './PhoneTabs';
import { phoneSessionErrorKey } from './phoneSessionError';
import cls from './PhoneSessionHost.module.scss';

/** Auth identity is a remount boundary: never reuse a phone/password across users or tenants. */
export function PhoneSessionHost({ children }: { children: ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const operator = useOperatorPhone();
  if (operator?.active) return <PhoneActionsProvider value={{ canCall: operator.canDial, call: operator.dial, configure: operator.open }}>{children}</PhoneActionsProvider>;
  if (!user || ![0, 1, 2, 3].includes(Number(user.level))) return children;
  return <PhoneOwner key={`${user.vpbx_user_uid}:${user.uniqueid}`} identity={`${user.vpbx_user_uid}:${user.uniqueid}`}>{children}</PhoneOwner>;
}

function PhoneOwner({ children, identity }: { children: ReactNode; identity: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const operatorEntry = useLocation().pathname.replace(/\/$/, '') === '/callcenter/agent';
  const { data, refetch, isLoading, isError } = usePhoneEndpointsQuery(identity, { pollingInterval: 30_000, refetchOnFocus: true });
  const [acquire, acquireState] = useConnectPhoneMutation();
  const [release] = useDisconnectPhoneMutation();
  const [heartbeat] = usePhoneHeartbeatMutation();
  const [restorePhone] = useRestorePhoneMutation();
  const [runtime, runtimeState] = usePhoneCredentialsMutation();
  const [dial, dialState] = usePhoneDialMutation();
  const [dialViaCallCenter, ccDialState] = usePhoneDialViaCallCenterMutation();
  const [connection, setConnection] = useState<PhoneConnection | null>(null);
  const [open, setOpen] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const openRef = useRef(false);
  openRef.current = open;
  const [selected, setSelected] = useState('');
  const [endpointSearch, setEndpointSearch] = useState('');
  const [mode, setMode] = useState<'sip' | 'webrtc'>('sip');
  const [callSeconds, setCallSeconds] = useState(0);
  const [error, setError] = useState('');
  const [tabOwned, setTabOwned] = useState(false);
  const [wantsPhone, setWantsPhone] = useState(true);
  const releaseTab = useRef<(() => void) | null>(null);
  const leaseExpires = useRef(0);
  const activeOwner = useRef(true);
  useEffect(() => {
    activeOwner.current = true;
    return () => { activeOwner.current = false; };
  }, []);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [owner] = useState(() => {
    const key = `phone-owner:${identity}`;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const value = sessionStorage.getItem(key) || `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    sessionStorage.setItem(key, value); // A random owner capability, never SIP credentials.
    return value;
  });
  const phone = useWebRTCPhone({ server: '', sipUser: '', sipPassword: '', sipDomain: '', iceServers: [], remoteAudioRef,
    });
  const disconnectTransport = phone.disconnect;
  const busy = ['dialing', 'ringing', 'in-call'].includes(phone.status);
  const connectionBusy = busy || switching || acquireState.isLoading;
  useEffect(() => {
    setCallSeconds(0);
    if (['ringing', 'dialing', 'in-call'].includes(phone.status)) setConfiguring(false);
    if (phone.status !== 'in-call') return;
    const started = Date.now();
    const timer = window.setInterval(() => setCallSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phone.status]);
  const showError = useCallback((reason: unknown) => {
    setError(phoneSessionErrorKey(reason));
  }, []);

  // A cloned sessionStorage must not create two WebRTC transports for the same browser session.
  useEffect(() => {
    if (!navigator.locks || !wantsPhone) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const claim = () => {
      void navigator.locks.request(`krasterisk-phone:${identity}`, { ifAvailable: true }, async (lock) => {
        if (disposed) return;
        // A reload/React refresh may not have released this window's previous lock yet.
        // Retry acquisition only; never obtain credentials until the lock is actually granted.
        if (!lock) { retry = setTimeout(claim, 750); return; }
        setTabOwned(true);
        await new Promise<void>((resolve) => { releaseTab.current = resolve; if (disposed) resolve(); });
      });
    };
    claim();
    return () => { disposed = true; clearTimeout(retry); releaseTab.current?.(); releaseTab.current = null; setTabOwned(false); };
  }, [identity, wantsPhone]);

  // Reload restores only this window's lease. Another tab cannot obtain its SIP password.
  useEffect(() => {
    if (!tabOwned) return;
    let active = true;
    const restore = async () => {
      try {
        const restored = await restorePhone({ owner }).unwrap();
        if (!active) return;
        if (!restored) { if (!openRef.current) setWantsPhone(false); return; }
        setConnection(restored);
        if (restored.mode === 'webrtc') {
          try {
            const config = await runtime({ owner }).unwrap();
            if (active && config.wssUrl) await phone.connect({ server: config.wssUrl, sipUser: config.credentials.username,
              sipPassword: config.credentials.password, sipDomain: config.credentials.domain, iceServers: config.iceServers });
            if (!active || !activeOwner.current) await phone.disconnect();
          } finally { runtimeState.reset(); }
        }
      } catch (reason) {
        // No previous lease is the normal first visit. A transport failure must remain visible.
        if (active && (reason as { status?: number })?.status !== 409) showError(reason);
        if (active && (reason as { status?: number })?.status === 409 && !openRef.current) setWantsPhone(false);
      }
    };
    void restore();
    return () => { active = false; };
    // Restore once per acquired browser lock; connect() reads its override into the transport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabOwned, owner]);

  useEffect(() => {
    if (!connection) return;
    leaseExpires.current = connection.expiresAt;
    let active = true;
    let inFlight = false;
    const beat = async () => {
      if (inFlight) return;
      inFlight = true;
      try { leaseExpires.current = (await heartbeat({ owner }).unwrap()).expiresAt; }
      catch (reason) {
        const denied = [401, 403, 409].includes(Number((reason as { status?: number })?.status));
        if (active && (denied || Date.now() >= leaseExpires.current)) {
          setError('phoneNumber.sessionLost');
          setConnection(null);
          await disconnectTransport();
        }
      } finally { inFlight = false; }
    };
    const interval = window.setInterval(() => void beat(), 30_000);
    window.addEventListener('online', beat);
    return () => { active = false; clearInterval(interval); window.removeEventListener('online', beat); };
  }, [connection, heartbeat, owner, disconnectTransport, t]);

  const connect = async (endpoint = selected, device = mode) => {
    if (!tabOwned || !endpoint || busy || switchingRef.current) return;
    setError('');
    if (connection?.endpoint === endpoint && connection.mode === device && (device === 'sip' || phone.status === 'registered')) {
      setConfiguring(false); return;
    }
    switchingRef.current = true;
    setSwitching(true);
    let acquiredLease = false;
    try {
      const fresh = await refetch();
      const candidate = fresh.data?.endpoints.find(item => item.id === endpoint);
      if (!candidate || (!candidate.available && candidate.id !== connection?.endpoint) || (device === 'webrtc' && !candidate.webrtc) || (device === 'sip' && candidate.sipAvailable === false)) {
        setError('phoneNumber.noLongerAvailable'); return;
      }
      const acquired = await acquire({ endpoint, mode: device, owner }).unwrap();
      if (!activeOwner.current) return;
      acquiredLease = true;
      await phone.disconnect();
      if (!activeOwner.current) return;
      setConnection(acquired);
      if (device === 'webrtc') {
        try {
          const config = await runtime({ owner }).unwrap();
          if (!activeOwner.current) return;
          if (!config.wssUrl) throw new Error('Missing WSS');
          await phone.connect({ server: config.wssUrl, sipUser: config.credentials.username,
            sipPassword: config.credentials.password, sipDomain: config.credentials.domain, iceServers: config.iceServers });
          if (!activeOwner.current) await phone.disconnect();
        } finally { runtimeState.reset(); }
      }
      if (activeOwner.current) { setConfiguring(false); setOpen(true); }
      void refetch();
    } catch (reason) {
      showError(reason);
      if (acquiredLease) { await phone.disconnect(); if (activeOwner.current) { setSelected(endpoint); setMode(device); setConfiguring(true); } }
      // A failed registration still has a lease; keep it visible so it can be disconnected/retried.
    } finally {
      switchingRef.current = false;
      if (activeOwner.current) setSwitching(false);
    }
  };
  const disconnect = async () => {
    setError('');
    try {
      if (busy || switchingRef.current) return false;
      await release({ owner }).unwrap();
      await phone.disconnect();
      setConnection(null);
      setConfiguring(true);
      runtimeState.reset();
      void refetch();
      return true;
    } catch (reason) { showError(reason); return false; }
  };
  const openShiftEntry = async () => {
    if (connection && !await disconnect()) return;
    setOpen(false);
    setConfiguring(false);
    navigate('/callcenter/agent');
    document.getElementById('shift-endpoint')?.focus();
  };
  const ccDeskPhone = data?.callCenterActive && data.callCenterPhone?.mode === 'sip';
  const canCall = Boolean(ccDeskPhone ? !ccDialState.isLoading : tabOwned && connection && !data?.callCenterActive && !dialState.isLoading && !busy
    && (connection.mode === 'sip' || phone.status === 'registered'));
  const call = async (value: string) => {
    const target = dialableNumber(value);
    if (!target || !canCall) return;
    if (ccDeskPhone) {
      try {
        const response = await dialViaCallCenter({ target }).unwrap();
        if (response.mode === 'webrtc') { navigate('/callcenter/agent'); return; }
        toast.info(t('phoneNumber.pickUp', { extension: data?.callCenterPhone?.extension }));
      } catch { toast.error(t('phoneNumber.callFailed')); }
      return;
    }
    setError('');
    try {
      const response = await dial({ owner, number: target }).unwrap();
      if (!activeOwner.current) return;
      if (response.mode === 'webrtc') await phone.makeCall(response.target);
      else toast.info(t('phoneNumber.pickUp', { extension: connection?.extension }));
    } catch (reason) { showError(reason); throw reason; }
  };
  const configure = () => {
    if (data?.callCenterActive) navigate('/callcenter/agent');
    else {
      setWantsPhone(true); setOpen(true); setConfiguring(true); setError('');
      setEndpointSearch('');
      setSelected(connection?.endpoint || ''); setMode(connection?.mode || 'sip'); void refetch();
    }
  };
  const availableEndpoints = data?.endpoints.filter(endpoint =>
    (endpoint.available || endpoint.id === connection?.endpoint) && (mode === 'webrtc' ? endpoint.webrtc : endpoint.sipAvailable !== false)) || [];
  const visibleEndpoints = availableEndpoints.filter(endpoint => `${endpoint.extension} ${endpoint.name}`.toLocaleLowerCase().includes(endpointSearch.trim().toLocaleLowerCase()) || endpoint.id === selected);
  const selectedEndpoint = availableEndpoints.find(endpoint => endpoint.id === selected);
  const connectionForm = <VStack gap="12" max className={cls.connection}>
    <HStack justify="between" max>
      <Text className="font-medium">{t(connection ? 'phoneNumber.change' : 'phoneNumber.connect')}</Text>
      <Tooltip content={t('phoneNumber.chooseHelp')}><HelpCircle size={16} aria-label={t('phoneNumber.chooseHelp')}/></Tooltip>
    </HStack>
    {error && <Text role="alert">{t(error)}</Text>}
    {isError && <Text role="alert">{t('phoneNumber.loadFailed')}</Text>}
    {!tabOwned && <Text variant="muted">{t(navigator.locks ? 'phoneNumber.otherTab' : 'phoneNumber.secureBrowser')}</Text>}
    <Label htmlFor="ordinary-phone-mode">{t('phoneNumber.device')}</Label>
    <Select id="ordinary-phone-mode" className={cls.select} value={mode} disabled={connectionBusy}
      onChange={event => { const next = event.target.value as 'sip' | 'webrtc'; setMode(next); if (next === 'webrtc' && !data?.endpoints.find(endpoint => endpoint.id === selected)?.webrtc) setSelected(''); }}>
      <option value="sip">{t('phoneNumber.deskMode')}</option><option value="webrtc">{t('phoneNumber.browserMode')}</option>
    </Select>
    <HStack justify="between" max><Label htmlFor="ordinary-phone-endpoint">{t('phoneNumber.subscriber')}</Label>
      <Tooltip content={t('phoneNumber.refresh')}><Button size="sm" variant="ghost" aria-label={t('phoneNumber.refresh')} onClick={() => void refetch()}><RefreshCw size={14}/></Button></Tooltip>
    </HStack>
    <Input aria-label={t('phoneNumber.findExtension')} placeholder={t('phoneNumber.findExtension')} value={endpointSearch} onChange={event => setEndpointSearch(event.target.value)} disabled={connectionBusy}/>
    <Select id="ordinary-phone-endpoint" className={cls.select} value={selectedEndpoint ? selected : ''} disabled={connectionBusy}
      onChange={event => setSelected(event.target.value)}>
      <option value="">{t('phoneNumber.choose')}</option>
      {visibleEndpoints.map(endpoint => <option key={endpoint.id} value={endpoint.id}>{endpoint.extension}{endpoint.name && endpoint.name !== endpoint.extension ? ` · ${endpoint.name}` : ''}</option>)}
    </Select>
    {!isLoading && !isError && availableEndpoints.length === 0 && <Text variant="muted">{t(mode === 'webrtc' ? 'phoneNumber.noWebrtc' : 'phoneNumber.noneAvailable')}</Text>}
    {data?.availabilityKnown === false && <Text role="alert">{t('phoneNumber.availabilityUnknown')}</Text>}
    <Button disabled={!tabOwned || !selectedEndpoint || connectionBusy || data?.availabilityKnown === false} onClick={() => void connect()}>
      {t(connection ? 'phoneNumber.apply' : 'phoneNumber.connect')}
    </Button>
    {connection && <HStack gap="8" max>
      <Button variant="ghost" disabled={connectionBusy} onClick={() => setConfiguring(false)}>{t('phoneNumber.back')}</Button>
      <Button variant="outline" disabled={connectionBusy} onClick={() => void disconnect()}>{t('phoneNumber.disconnect')}</Button>
    </HStack>}
  </VStack>;

  const shiftEntryContent = <VStack gap="12" align="stretch" className={cls.shiftEntry}>
    <Text className="font-medium">{t('phoneNumber.operatorEntry')}</Text>
    <Text variant="muted">{t(connection ? 'phoneNumber.operatorEntryConnected' : 'phoneNumber.operatorEntryHint')}</Text>
    {error && <Text role="alert">{t(error)}</Text>}
    <Button disabled={connectionBusy} onClick={() => void openShiftEntry()}>
      {t(connection ? 'phoneNumber.disconnectAndStartShift' : 'phoneNumber.goToShift')}
    </Button>
    {connection && <Button variant="ghost" onClick={() => setConfiguring(false)}>{t('phoneNumber.back')}</Button>}
  </VStack>;

  return <PhoneActionsProvider value={{ canCall, call, configure }}>
    {children}
    <audio ref={remoteAudioRef} autoPlay />
    {!data?.callCenterActive && <Flex className={cls.dock}>
      <SoftphoneWidget floating className={cls.ordinaryWidget} phone={{ ...phone, status: !connection ? 'disconnected' : connection.mode === 'sip' ? 'registered' : phone.status, makeCall: call }}
        panelOpen={open} onPanelOpenChange={value => { setOpen(value); if (value) { setWantsPhone(true); void refetch(); } }}
        mode={connection?.mode || mode} dialAllowed={canCall} callSeconds={callSeconds} standaloneControls autoOpenIncoming
        onRecover={() => connect(connection?.endpoint, connection?.mode)}
        connectionContent={!connection || configuring ? operatorEntry ? shiftEntryContent : connectionForm : undefined}
        journalContent={<PhoneJournal key={connection?.extension || 'disconnected'} identity={identity} extension={connection?.extension} canCall={canCall} onCall={number => void call(number).catch(() => toast.error(t('phoneNumber.callFailed')))}/>}
        contactsContent={<PhoneContacts identity={identity} canCall={canCall} onCall={number => void call(number).catch(() => toast.error(t('phoneNumber.callFailed')))}/>}
        sessionControls={connection && <HStack gap="8" max className={cls.session}>
          <Text className={cls.sessionNumber}>{t('phoneNumber.workingNumber', { extension: connection.extension })}</Text>
          <Tooltip content={t('phoneNumber.change')}><Button variant="ghost" size="sm" disabled={connectionBusy} aria-label={t('phoneNumber.change')} onClick={configure}><Settings2 size={16}/></Button></Tooltip>
        </HStack>}/>
    </Flex>}
  </PhoneActionsProvider>;
}
