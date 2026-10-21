#!/usr/bin/env python3
"""Isolated actual Asterisk lab, JSON lines protocol. Root supplies fresh secrets.
Official config references: github.com/asterisk/asterisk configs/samples.
Never loads production configs, logs, DB backends or external SIP routes.
"""
import csv, json, os, re, resource, shutil, signal, socket, struct, subprocess, sys, threading, time, uuid
from datetime import datetime, timezone
TENANTS=(910001,910002)
CDR_FIELDS=['calldate','clid','src','usrc','dst','dcontext','channel','dstchannel','lastapp','lastdata','duration','billsec','disposition','uniqueid','linkedid','userfield','vpbx_user_uid','dialednum','raw_start_epoch']
CEL_FIELDS=['eventtype','eventtime','cid_name','cid_num','exten','context','channame','appname','appdata','uniqueid','linkedid','peer','userfield','eventextra']
BINARY='/usr/sbin/asterisk'
MODULES='/usr/lib/asterisk/modules'
ENDPOINTS=['t_live_910001','e101_910001','e102_910001','e103_910001','t_live_910002','e101_910002']
DESTINATIONS={'100','101','102','103','700','701','702','703','704','900','901'}
def epoch_utc(value):
 if not isinstance(value,str) or not re.fullmatch(r'\d{9,12}(?:\.\d{1,6})?',value):raise ValueError('actual_cel_epoch_invalid')
 seconds,_,fraction=value.partition('.')
 actual=datetime.fromtimestamp(int(seconds),timezone.utc)
 milliseconds=int((fraction+'000000')[:6])//1000
 return actual.strftime('%Y-%m-%d %H:%M:%S')+'.%03d'%milliseconds

def bounded(value,low,high,default):
 value=default if value is None else value
 if isinstance(value,bool) or not isinstance(value,(int,float)) or not low<=value<=high:raise ValueError('invalid_numeric_parameter')
 return value

def process_fingerprint(pid):
 try:
  raw=open('/proc/%d/stat'%pid).read();start=raw[raw.rfind(')')+2:].split()[19]
  return(os.path.realpath('/proc/%d/exe'%pid),start)
 except(OSError,IndexError):return None

def main_processes():
 result={}
 for entry in os.listdir('/proc'):
  if entry.isdigit():
   fingerprint=process_fingerprint(int(entry))
   if fingerprint and fingerprint[0]==os.path.realpath(BINARY):result[int(entry)]=fingerprint
 return result

def loopback_sip_uri(value,port):
 # Parse one Contact URI rather than stripping angle delimiters from a header.
 # Asterisk UAS Contact omits userinfo when contact_user is empty.
 if not isinstance(value,str) or len(value)>1024 or any(ch in value for ch in '\r\n'):raise ValueError('foreign_sip_target')
 value=value.strip()
 if '<' in value or '>' in value:
  match=re.fullmatch(r'[^<>,]*<([^<>]+)>\s*(?:;[A-Za-z0-9_.-]+(?:=[A-Za-z0-9_.-]+)?)*',value)
  if not match:raise ValueError('foreign_sip_target')
  uri=match.group(1).strip()
 else:uri=value
 match=re.fullmatch(r'sip:(?:[A-Za-z0-9_.!~*\'()%+&=:$-]+@)?127\.0\.0\.1(?::(\d+))?((?:;(?:transport=udp|user=phone|lr))*)',uri,re.I)
 if not match or int(match.group(1) or 5060)!=port:raise ValueError('foreign_sip_target')
 return uri

def safe_uri(uri,port):
 loopback_sip_uri(uri,port)
 return('127.0.0.1',port)

def sdp_media(body):
 host=re.search(r'^c=IN IP4 ([^\s]+)',body,re.M);port=re.search(r'^m=audio (\d+) ',body,re.M)
 if not host or host.group(1)!='127.0.0.1' or not port:return None
 return('127.0.0.1',int(port.group(1)))

class SipUa:
 def __init__(self,name,lab):
  self.name,self.lab=name,lab
  self.socket=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);self.socket.bind(('127.0.0.1',0));self.socket.settimeout(0.02)
  self.port=self.socket.getsockname()[1]
  self.media=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);self.media.bind(('127.0.0.1',0));self.media.setblocking(False)
  self.media_port=self.media.getsockname()[1]
  self.lock,self.dialogs,self.closed=threading.RLock(),{},False
  self.registrations={}
  self.final_contacts,self.response_counts,self.protocol_errors=[],{},[]
  self.mode,self.answer_delay,self.hold='answer',0.5,120
  self.rtp_sent,self.rtp_received,self.invalid_sources=0,0,0
  self.thread=threading.Thread(target=self.run,daemon=True);self.thread.start()
 def sdp(self):
  return '\r\n'.join(['v=0','o=- 1 1 IN IP4 127.0.0.1','s=Isolated Dashboard Lab','c=IN IP4 127.0.0.1','t=0 0','m=audio %d RTP/AVP 0 101'%self.media_port,'a=rtpmap:0 PCMU/8000','a=rtpmap:101 telephone-event/8000','a=fmtp:101 0-16','a=sendrecv',''])
 def wire(self,start,headers,body=''):
  headers=list(headers)+[('Content-Length',str(len(body.encode())))]
  if body:headers.append(('Content-Type','application/sdp'))
  return(start+'\r\n'+''.join('%s: %s\r\n'%item for item in headers)+'\r\n'+body).encode()
 def send(self,data,address):
  if address!=('127.0.0.1',self.lab.ports['sip']):raise ValueError('foreign_sip_destination')
  self.socket.sendto(data,address)
 def response(self,dialog,status,phrase,body=''):
  headers=[(name,dialog['headers'][name.lower()]) for name in ['Via','From','Call-ID','CSeq']]
  target=dialog['headers']['to']
  if ';tag=' not in target:target+=';tag='+dialog['tag']
  headers.extend([('To',target),('Contact','<sip:%s@127.0.0.1:%d>'%(self.name,self.port))])
  wire=self.wire('SIP/2.0 %d %s'%(status,phrase),headers,body)
  self.send(wire,dialog['address']);dialog['last_response']=wire;return wire
 def request(self,dialog,method):
  outgoing=dialog['direction']=='outgoing'
  from_header=dialog['from'] if outgoing else dialog['local_to']
  to_header=dialog.get('remote_to',dialog['to']) if outgoing else dialog['headers']['from']
  failure_ack=method=='ACK' and dialog.get('failure')
  if method=='CANCEL':to_header=dialog['to']
  branch=dialog['branch'] if method=='CANCEL' or failure_ack else 'z9hG4bK'+uuid.uuid4().hex
  target=dialog['uri'] if method=='CANCEL' or failure_ack else dialog.get('contact') or dialog['uri']
  target=loopback_sip_uri(target,self.lab.ports['sip'])
  sequence=dialog.get('invite_cseq',1) if method in('ACK','CANCEL') else dialog.get('local_cseq',1)+1
  if method not in('ACK','CANCEL'):dialog['local_cseq']=sequence
  headers=[('Via','SIP/2.0/UDP 127.0.0.1:%d;branch=%s;rport'%(self.port,branch)),('Max-Forwards','10'),('From',from_header),('To',to_header),('Call-ID',dialog['id']),('CSeq','%d %s'%(sequence,method)),('Contact','<sip:%s@127.0.0.1:%d>'%(self.name,self.port))]
  wire=self.wire('%s %s SIP/2.0'%(method,target),headers)
  self.send(wire,dialog['address'])
  if method in('BYE','CANCEL'):
   now=time.monotonic();dialog.setdefault('transactions',{})[(sequence,method)]={'wire':wire,'created':now,'last_send':now,'interval':0.5}
  return sequence
 def originate(self,destination,hold):
  call_id='pbx-dashboard-live-'+uuid.uuid4().hex+'@127.0.0.1';branch='z9hG4bK'+uuid.uuid4().hex;tag=uuid.uuid4().hex[:12]
  uri='sip:%s@127.0.0.1:%d'%(destination,self.lab.ports['sip']);from_header='<sip:%s@127.0.0.1>;tag=%s'%(self.name,tag);to_header='<'+uri+'>'
  headers=[('Via','SIP/2.0/UDP 127.0.0.1:%d;branch=%s;rport'%(self.port,branch)),('Max-Forwards','10'),('From',from_header),('To',to_header),('Call-ID',call_id),('CSeq','1 INVITE'),('Contact','<sip:%s@127.0.0.1:%d>'%(self.name,self.port))]
  data=self.wire('INVITE %s SIP/2.0'%uri,headers,self.sdp())
  dialog={'id':call_id,'direction':'outgoing','state':'inviting','address':('127.0.0.1',self.lab.ports['sip']),'uri':uri,'from':from_header,'to':to_header,'branch':branch,'created':time.monotonic(),'last_invite':data,'last_send':time.monotonic(),'hold':hold,'invite_cseq':1,'local_cseq':1,'transactions':{},'seq':0,'timestamp':0,'ssrc':uuid.uuid4().int&0xffffffff}
  with self.lock:self.dialogs[call_id]=dialog
  self.send(data,dialog['address']);return call_id
 def register(self,expires):
  if len(self.registrations)>=32:raise ValueError('register_transaction_budget')
  call_id='pbx-dashboard-live-register-'+uuid.uuid4().hex+'@127.0.0.1';tag=uuid.uuid4().hex[:12];branch='z9hG4bK'+uuid.uuid4().hex
  uri='sip:127.0.0.1:%d'%self.lab.ports['sip'];identity='<sip:%s@127.0.0.1>'%self.name
  headers=[('Via','SIP/2.0/UDP 127.0.0.1:%d;branch=%s;rport'%(self.port,branch)),('Max-Forwards','10'),('From',identity+';tag='+tag),('To',identity),('Call-ID',call_id),('CSeq','1 REGISTER'),('Contact','<sip:%s@127.0.0.1:%d>'%(self.name,self.port)),('Expires',str(expires))]
  wire=self.wire('REGISTER %s SIP/2.0'%uri,headers);event=threading.Event()
  registration={'event':event,'status':None,'responseExpires':None}
  with self.lock:self.registrations[call_id]=registration
  deadline=time.monotonic()+5
  while time.monotonic()<deadline:
   self.send(wire,('127.0.0.1',self.lab.ports['sip']))
   if event.wait(0.5):break
  status=registration['status']
  if status is None:raise ValueError('own_register_timeout')
  return{'endpoint':self.name,'registered':200<=status<300,'status':status,'sipCallId':call_id,'requestedExpires':expires,'responseExpires':registration['responseExpires']}
 def hangup(self,call_id):
  with self.lock:
   dialog=self.dialogs.get(call_id)
   if not dialog or dialog['state'] in('ended','terminating','cancelling'):return False
   if dialog['state']=='talking':self.request(dialog,'BYE');dialog['state']='terminating'
   elif dialog['direction']=='outgoing':self.request(dialog,'CANCEL');dialog['state']='cancelling'
   else:self.response(dialog,486,'Busy Here');dialog['state']='ended'
   return True
 def incoming(self,raw,address):
  if address!=('127.0.0.1',self.lab.ports['sip']):self.invalid_sources+=1;return
  text=raw.decode(errors='replace');head,_,body=text.partition('\r\n\r\n');lines=head.split('\r\n');first=lines[0];headers={}
  for line in lines[1:]:
   if ':' in line:key,value=line.split(':',1);headers[key.strip().lower()]=value.strip()
  if not all(key in headers for key in ['call-id','via','from','to','cseq']):return
  call_id=headers['call-id']
  with self.lock:
   if first.startswith('SIP/2.0'):
    status=int(first.split()[1]);method=headers['cseq'].split()[-1]
    if method=='REGISTER':
     registration=self.registrations.get(call_id)
     if registration and status>=200:
      registration['status']=status;registration['responseExpires']=headers.get('expires');registration['event'].set()
     return
    dialog=self.dialogs.get(call_id)
    if not dialog:return
    cseq=int(headers['cseq'].split()[0]);key='%s:%d'%(method,status)
    if key in self.response_counts or len(self.response_counts)<32:self.response_counts[key]=self.response_counts.get(key,0)+1
    if method in('BYE','CANCEL'):
     pending=dialog.get('transactions',{}).get((cseq,method))
     if not pending or status<200:return
     dialog['transactions'].pop((cseq,method),None);dialog['termination_status']={'method':method,'cseq':cseq,'status':status}
     if method=='BYE':dialog['state']='ended' if status<300 or status==481 else 'terminationFailed'
     return
    if method!='INVITE' or cseq!=dialog.get('invite_cseq',1):return
    dialog['remote_to']=headers['to']
    if status<200:
     if dialog['state'] in('inviting','ringing'):dialog['state']='ringing'
     return
    if status<300:
     contact=headers.get('contact','')
     if contact:
      try:contact=loopback_sip_uri(contact,self.lab.ports['sip'])
      except ValueError:
       self.protocol_errors.append({'method':'INVITE','status':status,'error':'non_loopback_contact'});self.protocol_errors=self.protocol_errors[-12:];raise
      dialog['contact']=contact
      redacted=re.sub(r'^sip:[^@]+@','sip:[user]@',contact,flags=re.I)
      record={'method':'INVITE','status':status,'cseq':cseq,'hasUser':'@' in contact,'uri':redacted}
      if not self.final_contacts or self.final_contacts[-1]!=record:self.final_contacts.append(record);self.final_contacts=self.final_contacts[-12:]
     dialog.pop('failure',None);dialog['remote_media']=sdp_media(body);self.request(dialog,'ACK')
     # A 2xx crossing CANCEL creates a dialog: ACK it, then end with BYE.
     if dialog['state']=='cancelling':
      dialog.get('transactions',{}).pop((cseq,'CANCEL'),None);self.request(dialog,'BYE');dialog['state']='terminating'
     elif dialog['state'] not in('terminating','ended'):
      if dialog['state']!='talking':dialog['answered']=time.monotonic()
      dialog['state']='talking'
    else:dialog['failure']=status;self.request(dialog,'ACK');dialog['state']='ended';dialog.get('transactions',{}).clear()
    return
   method=first.split()[0]
   if method=='INVITE':
    dialog=self.dialogs.get(call_id);sequence=int(headers['cseq'].split()[0])
    if dialog and sequence==dialog.get('remote_invite_cseq') and dialog.get('last_response'):self.send(dialog['last_response'],address);return
    if dialog and dialog['state']=='talking':
     # In-dialog reINVITE has a new transaction; do not replay the old CSeq response.
     if sequence<=dialog.get('remote_invite_cseq',0):return
     dialog['headers']=headers;dialog['remote_invite_cseq']=sequence
     if headers.get('contact'):dialog['contact']=loopback_sip_uri(headers['contact'],self.lab.ports['sip'])
     dialog['remote_media']=sdp_media(body);dialog['acknowledged']=False
     self.response(dialog,200,'OK',self.sdp());dialog['final_response_at']=time.monotonic();dialog['final_interval']=0.5;return
    tag=uuid.uuid4().hex[:12]
    local_to=headers['to'] if ';tag=' in headers['to'] else headers['to']+';tag='+tag
    contact=loopback_sip_uri(headers['contact'],self.lab.ports['sip']) if headers.get('contact') else ''
    dialog={'id':call_id,'direction':'incoming','state':'ringing','address':address,'headers':headers,'tag':tag,'uri':first.split()[1],'to':headers['to'],'local_to':local_to,'from':headers['from'],'contact':contact,'created':time.monotonic(),'remote_media':sdp_media(body),'mode':self.mode,'answer_delay':self.answer_delay,'hold':self.hold,'local_cseq':1,'remote_invite_cseq':sequence,'transactions':{},'seq':0,'timestamp':0,'ssrc':uuid.uuid4().int&0xffffffff}
    self.dialogs[call_id]=dialog;self.response(dialog,100,'Trying')
    if self.mode=='busy':self.response(dialog,486,'Busy Here');dialog['state']='ended'
    else:self.response(dialog,180,'Ringing')
   elif method in('BYE','CANCEL'):
    dialog=self.dialogs.get(call_id);temporary={'headers':headers,'tag':dialog.get('tag',uuid.uuid4().hex[:12]) if dialog else uuid.uuid4().hex[:12],'address':address}
    self.response(temporary,200,'OK')
    if dialog:
     if method=='CANCEL' and dialog['direction']=='incoming':self.response(dialog,487,'Request Terminated')
     dialog['state']='ended'
   elif method=='ACK':
    if call_id in self.dialogs and int(headers['cseq'].split()[0])==self.dialogs[call_id].get('remote_invite_cseq'):self.dialogs[call_id]['acknowledged']=True
   elif method=='OPTIONS':self.response({'headers':headers,'tag':uuid.uuid4().hex[:12],'address':address},200,'OK')
 def tick(self):
  now=time.monotonic()
  with self.lock:
   for dialog in list(self.dialogs.values()):
    if dialog['direction']=='incoming' and dialog['state']=='ringing' and dialog['mode']=='answer' and now-dialog['created']>=dialog['answer_delay']:
     self.response(dialog,200,'OK',self.sdp());dialog['state']='talking';dialog['answered']=now;dialog['final_response_at']=now;dialog['final_interval']=0.5;dialog['acknowledged']=False
    if dialog['direction']=='outgoing' and dialog['state']=='inviting' and now-dialog['last_send']>0.5:
     if now-dialog['created']>12:dialog['state']='ended'
     else:self.send(dialog['last_invite'],dialog['address']);dialog['last_send']=now
    for transaction_key,transaction in list(dialog.get('transactions',{}).items()):
     if now-transaction['created']>=32:
      dialog['transactions'].pop(transaction_key,None);dialog['state']='terminationTimeout';continue
     if now-transaction['last_send']>=transaction['interval']:
      self.send(transaction['wire'],dialog['address']);transaction['last_send']=now;transaction['interval']=min(4,transaction['interval']*2)
    if dialog['direction']=='incoming' and dialog['state']=='talking' and not dialog.get('acknowledged') and dialog.get('final_response_at') and now-dialog['final_response_at']>=dialog['final_interval']:
     self.send(dialog['last_response'],dialog['address']);dialog['final_response_at']=now;dialog['final_interval']=min(4,dialog['final_interval']*2)
    if dialog['state']!='talking':continue
    if now-dialog.get('answered',now)>=dialog['hold']:self.hangup(dialog['id']);continue
    remote=dialog.get('remote_media')
    if remote and now-dialog.get('last_rtp',0)>=0.02:
     packet=struct.pack('!BBHII',0x80,0,dialog['seq']&0xffff,dialog['timestamp']&0xffffffff,dialog['ssrc'])+b'\xff'*160
     self.media.sendto(packet,remote);self.rtp_sent+=1;dialog['seq']+=1;dialog['timestamp']+=160;dialog['last_rtp']=now
  try:
   for _ in range(32):
    packet,address=self.media.recvfrom(2048)
    if address[0]=='127.0.0.1' and self.lab.ports['rtpStart']<=address[1]<=self.lab.ports['rtpEnd'] and len(packet)>=12:self.rtp_received+=1
  except BlockingIOError:pass
 def run(self):
  while not self.closed:
   try:raw,address=self.socket.recvfrom(65536);self.incoming(raw,address)
   except socket.timeout:pass
   except(OSError,ValueError,KeyError,IndexError):
    if self.closed:break
    self.invalid_sources+=1
   try:self.tick()
   except(OSError,ValueError):
    if self.closed:break
 def status(self):
  with self.lock:
   return{'name':self.name,'sipPort':self.port,'rtpPort':self.media_port,'dialogs':[{'sipCallId':d['id'],'direction':d['direction'],'state':d['state'],**({'termination':d['termination_status']} if d.get('termination_status') else {})} for d in self.dialogs.values()][-30:],'finalInviteContacts':list(self.final_contacts),'responseCounts':dict(self.response_counts),'protocolErrors':list(self.protocol_errors),'rtpSent':self.rtp_sent,'rtpReceived':self.rtp_received,'invalidSources':self.invalid_sources}
 def close(self):
  self.closed=True;self.socket.close();self.media.close();self.thread.join(timeout=0.3)

class Lab:
 def __init__(self):
  self.directory,self.process,self.output=None,None,None
  self.uas,self.calls,self.main,self.watchdog={},{},{},None
  self.lock=threading.RLock();self.cleaned=False
 def contained(self,filename=None):
  directory=self.directory
  if not directory or not re.fullmatch(r'/tmp/pbx-dashboard-live-[0-9a-f-]{36}',directory):return False
  if os.path.realpath(directory)!=directory or os.path.islink(directory):return False
  if filename is None:return True
  return os.path.commonpath([os.path.realpath(filename),directory])==directory
 def write(self,name,value):
  target=os.path.join(self.directory,'cfg',name)
  if not self.contained(target):raise ValueError('config_containment_failed')
  with open(target,'x',encoding='utf8') as handle:handle.write(value)
  os.chmod(target,0o600)
 def init(self,request):
  if self.directory:raise ValueError('already_initialized')
  secret=request.get('amiSecret','');ari_secret=request.get('ariSecret',uuid.uuid4().hex);user=request.get('amiUser','dashboard-live')
  if not re.fullmatch(r'[A-Za-z0-9_-]{16,128}',secret) or not re.fullmatch(r'[A-Za-z0-9_-]{16,128}',ari_secret) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',user):raise ValueError('invalid_fresh_credentials')
  self.ami_user,self.ami_secret,self.ari_secret=user,secret,ari_secret
  self.ports={'ami':15538,'sip':15606,'ari':15808,'rtpStart':42000,'rtpEnd':42039};supplied=request.get('ports',{})
  if not isinstance(supplied,dict) or any(key not in self.ports for key in supplied):raise ValueError('invalid_port_keys')
  for key,value in supplied.items():self.ports[key]=int(bounded(value,10000,65000,self.ports[key]))
  if not 8<=self.ports['rtpEnd']-self.ports['rtpStart']<=40:raise ValueError('invalid_bounded_rtp_range')
  try:production_rtp=open('/etc/asterisk/rtp.conf').read(32768)
  except OSError:production_rtp=''
  start=re.search(r'^\s*rtpstart\s*=\s*(\d+)',production_rtp,re.M);end=re.search(r'^\s*rtpend\s*=\s*(\d+)',production_rtp,re.M)
  production_start=int(start.group(1)) if start else 5000;production_end=int(end.group(1)) if end else 31000
  if self.ports['rtpStart']<=production_end and self.ports['rtpEnd']>=production_start:raise ValueError('rtp_overlaps_production_range')
  tests=[(socket.SOCK_STREAM,self.ports['ami']),(socket.SOCK_STREAM,self.ports['ari']),(socket.SOCK_DGRAM,self.ports['sip'])]+[(socket.SOCK_DGRAM,p) for p in range(self.ports['rtpStart'],self.ports['rtpEnd']+1)]
  for kind,port in tests:
   sock=socket.socket(socket.AF_INET,kind)
   try:
    if kind==socket.SOCK_STREAM:sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
    sock.bind(('127.0.0.1',port))
   finally:sock.close()
  self.main=main_processes();self.directory='/tmp/pbx-dashboard-live-'+str(uuid.uuid4());os.mkdir(self.directory,0o700)
  for name in ['cfg','data','db','cache','keys','agi','spool','run','log','log/cdr-custom','log/cel-custom','data/sounds','data/documentation','spool/voicemail/lab','spool/voicemail/lab/101']:
   os.makedirs(os.path.join(self.directory,name),mode=0o700,exist_ok=True)
  for name in ENDPOINTS:self.uas[name]=SipUa(name,self)
  self.build_config(user,secret,ari_secret)
  self.watchdog=threading.Timer(900,self.timeout);self.watchdog.daemon=True;self.watchdog.start()
  return{'directory':self.directory,'ports':self.ports,'endpointNames':ENDPOINTS,'timezone':'UTC','mainPids':list(self.main),'started':False,'cdrFields':CDR_FIELDS,'celFields':CEL_FIELDS}
 def build_config(self,user,secret,ari_secret):
  d=self.directory;dirs={'astcachedir':'cache','astetcdir':'cfg','astvarlibdir':'data','astdbdir':'db','astkeydir':'keys','astdatadir':'data','astagidir':'agi','astspooldir':'spool','astrundir':'run','astlogdir':'log'}
  self.write('asterisk.conf','[directories]\n'+''.join('%s => %s/%s\n'%(key,d,value) for key,value in dirs.items())+'astmoddir => '+MODULES+'\nastsbindir => /usr/sbin\n[options]\nnofork=yes\nquiet=yes\nnocolor=yes\nexecincludes=no\nmaxcalls=4\nmaxload=1.5\nminmemfree=96\nsystemname=pbx_dashboard_live\n[files]\nastctl=asterisk.ctl\n')
  whitelist=['res_pjproject.so','res_sorcery_config.so','res_sorcery_memory.so','res_sorcery_astdb.so','res_timing_timerfd.so','bridge_simple.so','bridge_native_rtp.so','res_rtp_asterisk.so','res_pjsip.so','res_pjsip_authenticator_digest.so','res_pjsip_outbound_authenticator_digest.so','res_pjsip_outbound_registration.so','res_pjsip_registrar.so','res_pjsip_endpoint_identifier_user.so','res_pjsip_endpoint_identifier_ip.so','res_pjsip_header_funcs.so','res_pjsip_pubsub.so','res_pjsip_nat.so','res_pjsip_session.so','res_pjsip_sdp_rtp.so','res_pjsip_caller_id.so','res_pjsip_dtmf_info.so','chan_pjsip.so','res_http_websocket.so','res_websocket_client.so','res_stasis.so','res_stasis_answer.so','res_stasis_recording.so','res_stasis_snoop.so','res_stasis_playback.so','res_ari.so','res_ari_model.so','res_ari_events.so','res_ari_applications.so','res_ari_channels.so','res_ari_playbacks.so','res_ari_bridges.so','app_stasis.so','func_channel.so','func_callerid.so','func_cdr.so','func_strings.so','func_logic.so','app_stack.so','app_dial.so','app_playback.so','app_voicemail.so','app_transfer.so','app_cdr.so','codec_ulaw.so','codec_alaw.so','format_pcm.so','format_wav.so','pbx_config.so','cdr_custom.so','cel_custom.so']
  selected=[name for name in whitelist if os.path.isfile(os.path.join(MODULES,name))]
  if not all(name in selected for name in ['chan_pjsip.so','res_pjsip.so','res_pjsip_outbound_registration.so','res_pjsip_registrar.so','bridge_simple.so','app_dial.so','func_strings.so','func_cdr.so','cdr_custom.so','cel_custom.so']):raise ValueError('required_installed_module_missing')
  # Core Stasis config registration needs XML docs under private ASTDATADIR.
  # Copy only these installed public docs; never point writable data/db at production.
  documentation=None
  for root in ['/var/lib/asterisk/documentation','/usr/share/asterisk/documentation']:
   if os.path.isfile(os.path.join(root,'core-en_US.xml')):documentation=root;break
  if not documentation:raise ValueError('installed_public_documentation_missing')
  for name in ['core-en_US.xml','appdocsxml.dtd','appdocsxml.xslt']:
   source=os.path.join(documentation,name);target=os.path.join(d,'data','documentation',name)
   if not os.path.isfile(source):
    if name=='core-en_US.xml':raise ValueError('installed_public_documentation_missing')
    continue
   if os.path.commonpath([os.path.realpath(source),documentation])!=documentation or os.path.getsize(source)>2*1024*1024 or not self.contained(target):raise ValueError('public_documentation_containment_failed')
   with open(source,'rb') as reader,open(target,'xb') as writer:writer.write(reader.read(2*1024*1024+1))
   os.chmod(target,0o600)
  self.write('modules.conf','[modules]\nautoload=no\n'+''.join('load => '+name+'\n' for name in selected))
  self.write('logger.conf','[general]\ndateformat=%F %T\n[logfiles]\nconsole => error\nmessages => warning,error\n')
  self.write('manager.conf','[general]\nenabled=yes\nwebenabled=no\nbindaddr=127.0.0.1\nport=%d\n[%s]\nsecret=%s\ndeny=0.0.0.0/0.0.0.0\npermit=127.0.0.1/255.255.255.255\nread=all\nwrite=all\n'%(self.ports['ami'],user,secret))
  self.write('http.conf','[general]\nenabled=yes\nbindaddr=127.0.0.1\nbindport=%d\nenablestatic=no\n'%self.ports['ari'])
  self.write('ari.conf','[general]\nenabled=yes\npretty=no\n[lab]\ntype=user\nread_only=no\npassword='+ari_secret+'\n')
  self.write('rtp.conf','[general]\nrtpstart=%d\nrtpend=%d\nicesupport=no\nstunaddr=\n'%(self.ports['rtpStart'],self.ports['rtpEnd']))
  self.write('cdr.conf','[general]\nenable=yes\nbatch=no\nunanswered=yes\ncongestion=yes\nendbeforehexten=yes\n')
  cdr_names=['start','clid','src','usrc','dst','dcontext','channel','dstchannel','lastapp','lastdata','duration','billsec','disposition','uniqueid','linkedid','userfield','vpbx_user_uid','dialednum']
  # Native actual epoch is the source of truth; explicit UTC avoids ast_localtime host defaults.
  cdr_expressions=['${STRFTIME(${CDR(start,u)},UTC,%Y-%m-%d %H:%M:%S)}']+['${CDR('+name+')}' for name in cdr_names[1:]]+['${CDR(start,u)}']
  self.write('cdr_custom.conf','[mappings]\nMaster.csv => '+','.join('${CSV_QUOTE('+expression+')}' for expression in cdr_expressions)+'\n')
  self.write('cel.conf','[general]\nenable=yes\nevents=ALL\napps=Answer,Dial,Playback,VoiceMail,Background,Read,WaitExten,Stasis,Queue\n; No dateformat: native CEL epoch, normalized explicitly at sync\n')
  expressions=['${eventtype}','${eventtime}','${CALLERID(name)}','${CALLERID(num)}','${CHANNEL(exten)}','${CHANNEL(context)}','${CHANNEL(channame)}','${CHANNEL(appname)}','${CHANNEL(appdata)}','${CHANNEL(uniqueid)}','${CHANNEL(linkedid)}','${BRIDGEPEER}','${CHANNEL(userfield)}','${eventextra}']
  self.write('cel_custom.conf','[mappings]\nMaster.csv => '+','.join('${CSV_QUOTE('+expression+')}' for expression in expressions)+'\n')
  self.write('voicemail.conf','[general]\nformat=wav\nmaxsecs=30\nminsecs=1\nmaxsilence=0\nattach=no\n[lab]\n101 => 123456,Isolated Lab\n')
  self.write('features.conf','[general]\n[featuremap]\nblindxfer => #1\n')
  for empty in ['extconfig.conf','sorcery.conf','res_odbc.conf','acl.conf','stasis.conf','websocket_client.conf']:self.write(empty,'; isolated lab: no production configuration or database bindings\n')
  pjsip='[global]\ntype=global\nendpoint_identifier_order=username\n[lab-loopback]\ntype=transport\nprotocol=udp\nbind=127.0.0.1:%d\n'%self.ports['sip']
  for name,ua in self.uas.items():
   tenant=int(name.rsplit('_',1)[1]);trunk=name.startswith('t_');ext=name[1:4] if not trunk else 'lab'+str(tenant)
   pjsip+='\n[%s]\ntype=endpoint\ntransport=lab-loopback\ncontext=%s\ndisallow=all\nallow=ulaw\naors=%s\nidentify_by=username\ndirect_media=no\nrtp_symmetric=yes\nforce_rport=yes\nrewrite_contact=yes\nmedia_address=127.0.0.1\nbind_rtp_to_media_address=yes\ncallerid=Isolated Lab <%s>\nset_var=__LAB_TENANT=%d\n[%s]\ntype=aor\nmax_contacts=2\nremove_existing=yes\ncontact=sip:%s@127.0.0.1:%d\n'%(name,'sip-in'+str(tenant) if trunk else 'internal',name,ext,tenant,name,name,ua.port)
  self.write('pjsip.conf',pjsip)
  dialplan='[general]\nstatic=yes\nwriteprotect=yes\n[internal]\n'
  for ext in ['101','102','103']:
   dialplan+='exten => %s,1,Set(CDR(vpbx_user_uid)=${LAB_TENANT})\nsame => n,Set(CDR(usrc)=${CALLERID(num)})\nsame => n,Dial(PJSIP/e%s_${LAB_TENANT},25)\n'%(ext,ext)
  for ext in ['700','701','702','703','704']:
   dialplan+='exten => %s,1,Goto(lab-service-${LAB_TENANT},%s,1)\n'%(ext,ext)
  dialplan+='exten => 900,1,Goto(sip-out${LAB_TENANT},900,1)\nexten => 901,1,Goto(autodial_lab_${LAB_TENANT},901,1)\n'
  for tenant in TENANTS:
   dialplan+='\n[sip-in%d]\n'%tenant
   for ext,target in [('100','101'),('101','101'),('102','102'),('103','103')]:
    dialplan+='exten => %s,1,Set(CDR(vpbx_user_uid)=%d)\nsame => n,Dial(PJSIP/e%s_%d,25)\n'%(ext,tenant,target,tenant)
   for ext in ['700','701','702','703','704']:
    dialplan+='exten => %s,1,Goto(lab-service-%d,%s,1)\n'%(ext,tenant,ext)
   dialplan+='exten => 901,1,Goto(autodial_lab_%d,901,1)\n[lab-service-%d]\n'%(tenant,tenant)
   for ext,application in [('700','Playback(lab-silence)'),('701','VoiceMail(101@lab,bs)'),('702','Stasis(krasterisk_dashboard_live_ai)')]:
    dialplan+='exten => %s,1,Set(CDR(vpbx_user_uid)=%d)\nsame => n,%s\nsame => n,Hangup()\n'%(ext,tenant,application)
   dialplan+='exten => 703,1,Set(CDR(vpbx_user_uid)=%d)\nsame => n,Answer()\nsame => n,Playback(lab-silence)\nsame => n,Hangup()\nexten => 704,1,Set(CDR(vpbx_user_uid)=%d)\nsame => n,Answer()\nsame => n,Dial(PJSIP/t_live_%d,25)\nsame => n,Hangup()\n'%(tenant,tenant,tenant)
   dialplan+='[sip-out%d]\nexten => 900,1,Set(CDR(vpbx_user_uid)=%d)\nsame => n,Set(CDR(usrc)=${CALLERID(num)})\nsame => n,Dial(PJSIP/t_live_%d,25)\n[autodial_lab_%d]\nexten => 901,1,Set(CDR(vpbx_user_uid)=%d)\nsame => n,Set(CDR(userfield)=autodial_lab)\nsame => n,Dial(PJSIP/t_live_%d,25)\n'%(tenant,tenant,tenant,tenant,tenant,tenant)
  self.write('extensions.conf',dialplan)
  sound_dir=os.path.join(d,'data','sounds')
  for language in ['en','en_US','ru']:
   for root in ['/var/lib/asterisk/sounds','/usr/share/asterisk/sounds']:
    source=os.path.join(root,language)
    if os.path.isdir(source):os.symlink(source,os.path.join(sound_dir,language));break
  with open(os.path.join(sound_dir,'lab-silence.ulaw'),'xb') as audio:audio.write(b'\xff'*(8000*18))
  # Private fixed greeting is configuration, not a fabricated playback/session event.
  greeting=os.path.join(d,'spool','voicemail','lab','101','busy.ulaw')
  if not self.contained(greeting):raise ValueError('private_greeting_containment_failed')
  with open(greeting,'xb') as audio:audio.write(b'\xff'*(8000*18))
  self.config=os.path.join(d,'cfg','asterisk.conf')
 def owned_process(self):
  if not self.process or self.process.poll() is not None:return True
  try:
   cmd=open('/proc/%d/cmdline'%self.process.pid,'rb').read(8192).decode().split('\0')
   return os.path.realpath('/proc/%d/exe'%self.process.pid)==os.path.realpath(BINARY) and '-C' in cmd and cmd[cmd.index('-C')+1]==self.config and self.contained(self.config)
  except(OSError,IndexError):return False
 def cli(self,command):
  if not self.process or self.process.poll() is not None or not self.owned_process():return ''
  p=subprocess.run([BINARY,'-C',self.config,'-rx',command],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,timeout=5)
  return p.stdout[:65536] if p.returncode==0 else ''
 def start(self):
  if not self.directory or(self.process and self.process.poll() is None):raise ValueError('not_initialized_or_already_started')
  self.output=open(os.path.join(self.directory,'log','process.log'),'ab')
  environment=dict(os.environ);environment['TZ']='UTC';
  def limits():os.nice(10);resource.setrlimit(resource.RLIMIT_CORE,(0,0))
  self.process=subprocess.Popen([BINARY,'-f','-n','-q','-C',self.config],cwd=self.directory,env=environment,stdin=subprocess.DEVNULL,stdout=self.output,stderr=self.output,preexec_fn=limits)
  deadline=time.monotonic()+20
  while time.monotonic()<deadline:
   if self.process.poll() is not None:raise ValueError('own_asterisk_start_failed')
   if os.path.exists(os.path.join(self.directory,'run','asterisk.ctl')):
    try:
     with socket.create_connection(('127.0.0.1',self.ports['ami']),timeout=0.3) as ami:banner=ami.recv(100)
     if banner.startswith(b'Asterisk Call Manager'):
      endpoints=self.cli('pjsip show endpoints')
      if all(name in endpoints for name in ENDPOINTS):return{'started':True,'ownPid':self.process.pid,'ports':self.ports,'mainUnchanged':self.main_unchanged(),'endpointsLoaded':len(ENDPOINTS),'inventory':self.inventory(),'ownLogLines':self.debug()}
    except OSError:pass
   time.sleep(0.2)
  raise ValueError('own_asterisk_start_timeout')
 def main_unchanged(self):return all(process_fingerprint(pid)==fingerprint for pid,fingerprint in self.main.items())
 def register(self,request):
  if not self.process or self.process.poll() is not None:raise ValueError('lab_not_running')
  endpoint=request.get('endpoint','e101_910001')
  if endpoint not in self.uas:raise ValueError('unconfigured_register_endpoint')
  expires=int(bounded(request.get('expires'),30,900,123))
  return self.uas[endpoint].register(expires)
 def call(self,request):
  if not self.process or self.process.poll() is not None:raise ValueError('lab_not_running')
  source=request.get('srcEndpoint','t_live_910001');destination=str(request.get('destination','100'))
  if source not in self.uas or destination not in DESTINATIONS:raise ValueError('unconfigured_call_target')
  with self.lock:
   active=sum(self.uas[value['source']].dialogs[value['sipCallId']]['state']!='ended' for value in self.calls.values())
   if active>=4:raise ValueError('logical_call_budget_exceeded')
   mode=request.get('mode','answer')
   if mode not in('answer','ignore','busy'):raise ValueError('invalid_ua_answer_mode')
   delay=bounded(request.get('answerDelay'),0,15,0.5);hold=bounded(request.get('holdSeconds'),1,180,120)
   tenant=int(source.rsplit('_',1)[1]);target_ext='101' if destination in('100','101','901') else destination
   target='t_live_%d'%tenant if destination in('900','901','704') else 'e%s_%d'%(target_ext,tenant)
   if target in self.uas:self.uas[target].mode,self.uas[target].answer_delay,self.uas[target].hold=mode,delay,hold
   call_id=uuid.uuid4().hex;sip_id=self.uas[source].originate(destination,hold)
   self.calls[call_id]={'source':source,'sipCallId':sip_id,'destination':destination}
   return{'callId':call_id,'sipCallId':sip_id,'source':source,'destination':destination,'mode':mode}
 def status(self):
  raw=self.cli('core show channels count');counts={kind:int(number) for number,kind in re.findall(r'^(\d+) active (channels|calls)',raw,re.M)}
  return{'started':bool(self.process and self.process.poll() is None),'ownPid':self.process.pid if self.process else None,'mainUnchanged':self.main_unchanged(),'coreCounts':counts,'uas':[ua.status() for ua in self.uas.values()],'ownCalls':self.calls,'rawCounts':self.csv_counts(),'resources':self.resources(),'inventory':self.inventory(),'ownMessages':self.own_messages()}
 def own_messages(self):
  filename=os.path.join(self.directory,'log','messages') if self.directory else None
  if not filename or not self.contained(filename) or not os.path.isfile(filename):return []
  with open(filename,'rb') as handle:
   handle.seek(max(0,os.path.getsize(filename)-32768));raw=handle.read(32768).decode(errors='replace')
  lines=[]
  for line in raw.splitlines()[-20:]:
   for secret in [getattr(self,'ami_secret',''),getattr(self,'ari_secret','')]:
    if secret:line=line.replace(secret,'[redacted]')
   line=re.sub(r'(?i)(secret|password)\s*[=:]\s*[^\s,;]+',r'\1=[redacted]',line).replace(self.directory,'<own-lab>')
   lines.append(line[:500])
  return lines
 def inventory(self):
  if not self.process or self.process.poll() is not None:return{'running':False}
  aors=self.cli('pjsip show aors');contacts=self.cli('pjsip show contacts')
  aor_names=[name for name in ENDPOINTS if re.search(r'\b'+re.escape(name)+r'\b',aors)]
  contact_rows=[line for line in contacts.splitlines() if re.search(r'^\s*Contact:\s+(?:e(?:101|102|103)|t_live)_91000[12](?:/|@)',line)]
  return{'running':True,'aorNamesFound':aor_names,'aorCount':len(aor_names),'cliContactCount':len(contact_rows),'aorCommandAvailable':'No such command' not in aors,'contactCommandAvailable':'No such command' not in contacts,'note':'CLI contacts include AoR permanent contacts; AMI PJSIPShowContacts reads Sorcery dynamic contacts in Asterisk22'}
 def resources(self):
  available=None;rss=None
  try:
   for line in open('/proc/meminfo'):
    if line.startswith('MemAvailable:'):available=int(line.split()[1])
  except OSError:pass
  if self.process and self.process.poll() is None:
   try:
    for line in open('/proc/%d/status'%self.process.pid):
     if line.startswith('VmRSS:'):rss=int(line.split()[1])
   except OSError:pass
  return{'rssKiB':rss,'availableMemKiB':available,'loadAvg':list(os.getloadavg())}
 def debug(self):
  lines=[]
  if not self.directory:return lines
  for name in ['process.log','messages']:
   filename=os.path.join(self.directory,'log',name)
   if not self.contained(filename) or not os.path.isfile(filename):continue
   with open(filename,'rb') as handle:
    handle.seek(max(0,os.path.getsize(filename)-32768));raw=handle.read(32768).decode(errors='replace')
   selected=[line for line in raw.splitlines() if re.search(r'error|warning|failed|declin|unable|cannot|dependency',line,re.I)][-8:]
   for line in selected:
    for value in [self.ami_secret,self.ari_secret,self.ami_user]:line=line.replace(value,'<redacted>')
    line=re.sub(r'\x1b\[[0-9;]*m','',line)
    lines.append(line[:320])
  return lines[-16:]
 def csv_counts(self):
  result={}
  for category in ['cdr','cel']:
   filename=os.path.join(self.directory,'log',category+'-custom','Master.csv') if self.directory else None
   if not filename or not self.contained(filename) or not os.path.isfile(filename):result[category]=0;continue
   if os.path.getsize(filename)>4*1024*1024:raise ValueError('csv_file_budget_exceeded')
   with open(filename,'rb') as handle:result[category]=handle.read(4*1024*1024+1).count(b'\n')
  return result
 def sync(self,request):
  cursor=request.get('cursor',{});limit=int(bounded(request.get('limit'),1,1000,500))
  if not isinstance(cursor,dict):raise ValueError('invalid_csv_cursor')
  result,next_cursor={},{}
  for category,fields in [('cdr',CDR_FIELDS),('cel',CEL_FIELDS)]:
   start=int(bounded(cursor.get(category),0,1000000,0));file=os.path.join(self.directory,'log',category+'-custom','Master.csv')
   if not self.contained(file):raise ValueError('csv_containment_failed')
   rows=[]
   if os.path.isfile(file):
    if os.path.getsize(file)>4*1024*1024:raise ValueError('csv_file_budget_exceeded')
    with open(file,'r',encoding='utf8',newline='') as handle:raw=handle.read(4*1024*1024+1)
    lines=raw.splitlines(keepends=True)
    if lines and not lines[-1].endswith('\n'):lines.pop()
    for index,line in enumerate(lines[start:start+limit],start=start+1):
     values=next(csv.reader([line],strict=True))
     if len(values)!=len(fields):raise ValueError('unexpected_actual_csv_schema')
     row=dict(zip(fields,values));row['id']=index;row['sourceKey']=os.path.basename(self.directory)+':'+category+':'+str(index)
     if category=='cel':
      row['raw_eventtime_epoch']=row['eventtime'];row['eventtime']=epoch_utc(row['eventtime'])
     for field in ['duration','billsec','vpbx_user_uid']:
      if field in row:row[field]=int(row[field]) if row[field].isdigit() else None
     rows.append(row)
   result[category]=rows;next_cursor[category]=start+len(rows)
  return{'source':'actual-isolated-asterisk-csv','timezone':'UTC','cdr':result['cdr'],'cel':result['cel'],'cursor':next_cursor,'mainUnchanged':self.main_unchanged()}
 def ami_request(self,action,fields=None,complete=None):
  if not self.process or self.process.poll() is not None or not self.owned_process():raise ValueError('lab_not_running')
  with socket.create_connection(('127.0.0.1',self.ports['ami']),timeout=3) as client:
   client.settimeout(0.5);buffer=b'';deadline=time.monotonic()+5
   def send(items):client.sendall((''.join('%s: %s\r\n'%item for item in items.items())+'\r\n').encode())
   def frame():
    nonlocal buffer
    while time.monotonic()<deadline:
     if b'\r\n\r\n' in buffer:
      raw,buffer=buffer.split(b'\r\n\r\n',1);result={}
      for line in raw.decode(errors='replace').split('\r\n'):
       if ': ' in line:key,value=line.split(': ',1);result[key.lower()]=value
      return result
     try:
      chunk=client.recv(16384)
      if not chunk:return None
      buffer+=chunk
      if len(buffer)>131072:raise ValueError('own_ami_frame_budget')
     except socket.timeout:pass
    return None
   login='lab-'+uuid.uuid4().hex;send({'Action':'Login','Username':self.ami_user,'Secret':self.ami_secret,'Events':'off','ActionID':login})
   while True:
    item=frame()
    if not item:raise ValueError('own_ami_login_timeout')
    if item.get('actionid')==login:
     if item.get('response')!='Success':raise ValueError('own_ami_login_rejected')
     break
   action_id='lab-'+uuid.uuid4().hex;deadline=time.monotonic()+5;send({'Action':action,'ActionID':action_id,**(fields or {})});result=[]
   while True:
    item=frame()
    if not item:raise ValueError('own_ami_action_timeout')
    if item.get('actionid')!=action_id:continue
    result.append(item)
    if len(result)>32:raise ValueError('own_ami_row_budget')
    if complete and item.get('event','').lower()==complete.lower():return result
    if not complete and 'response' in item:return item
    if item.get('response')=='Error':raise ValueError('own_ami_action_rejected')
 def transfer(self,request):
  own=self.calls.get(request.get('callId'));destination=str(request.get('destination','102'))
  if not own or destination not in('101','102','103'):raise ValueError('invalid_own_transfer')
  tenant=int(own['source'].rsplit('_',1)[1]);target='e%s_%d'%(destination,tenant)
  if target not in self.uas:raise ValueError('unconfigured_transfer_endpoint')
  self.uas[target].mode='answer';self.uas[target].answer_delay=bounded(request.get('answerDelay'),0,15,1);self.uas[target].hold=bounded(request.get('holdSeconds'),1,180,60)
  channels=self.ami_request('CoreShowChannels',complete='CoreShowChannelsComplete');source=None
  for item in channels:
   channel=item.get('channel','')
   if not channel.startswith('PJSIP/'+own['source']+'-'):continue
   variable=self.ami_request('Getvar',{'Channel':channel,'Variable':'PJSIP_HEADER(read,Call-ID)'})
   if variable.get('value')==own['sipCallId']:source=channel;break
  if not source:raise ValueError('own_sip_channel_not_found')
  peer=self.ami_request('Getvar',{'Channel':source,'Variable':'BRIDGEPEER'}).get('value','')
  if not re.fullmatch(r'PJSIP/e(?:101|102|103)_%d-[0-9a-f]+'%tenant,peer):raise ValueError('own_employee_bridge_not_found')
  answer=self.ami_request('BlindTransfer',{'Channel':peer,'Exten':destination,'Context':'sip-in'+str(tenant)})
  if answer.get('response')!='Success':raise ValueError('own_blind_transfer_rejected')
  return{'transferRequested':True,'callId':request['callId'],'destination':destination,'sourceChannel':source,'employeeChannel':peer}
 def pause(self):
  stopped=not self.process or self.process.poll() is not None
  if not stopped:
   if not self.owned_process():raise ValueError('own_process_verification_failed')
   self.process.terminate()
   try:self.process.wait(timeout=6)
   except subprocess.TimeoutExpired:
    if self.owned_process():self.process.kill();self.process.wait(timeout=3)
   stopped=self.process.poll() is not None
  if self.output:self.output.close();self.output=None
  return{'ownPidStopped':stopped,'directoryRetained':bool(self.directory and os.path.isdir(self.directory)),'mainUnchanged':self.main_unchanged()}
 def ports_released(self):
  if not hasattr(self,'ports'):return True
  ports=[(socket.SOCK_STREAM,self.ports['ami']),(socket.SOCK_STREAM,self.ports['ari']),(socket.SOCK_DGRAM,self.ports['sip'])]+[(socket.SOCK_DGRAM,p) for p in range(self.ports['rtpStart'],self.ports['rtpEnd']+1)]
  for kind,port in ports:
   probe=socket.socket(socket.AF_INET,kind)
   try:
    if kind==socket.SOCK_STREAM:probe.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
    probe.bind(('127.0.0.1',port))
   except OSError:return False
   finally:probe.close()
  return True
 def cleanup(self):
  with self.lock:
   if self.cleaned:return{'cleaned':True,'mainUnchanged':self.main_unchanged(),'ownPidStopped':True,'directoryRemoved':True,'portsReleased':self.ports_released()}
   if self.watchdog:self.watchdog.cancel()
   for ua in self.uas.values():
    for call_id in list(ua.dialogs):
     try:ua.hangup(call_id)
     except(OSError,ValueError):pass
   stopped=self.pause()['ownPidStopped']
   for ua in self.uas.values():ua.close()
   safe=self.contained();removed=self.directory is None
   if stopped and safe:shutil.rmtree(self.directory);removed=not os.path.exists(self.directory)
   self.cleaned=stopped and removed
   return{'cleaned':self.cleaned,'mainUnchanged':self.main_unchanged(),'ownPidStopped':stopped,'directoryRemoved':removed,'directoryContainmentVerified':safe,'portsReleased':self.ports_released()}
 def timeout(self):self.cleanup();os._exit(124)

lab=Lab()
def interrupt(signum,frame):lab.cleanup();raise SystemExit(0)
def main():
 for signum in [signal.SIGTERM,signal.SIGINT,signal.SIGHUP]:signal.signal(signum,interrupt)
 try:
  for line in sys.stdin:
   if len(line)>65536:raise ValueError('request_budget_exceeded')
   request={}
   try:
    request=json.loads(line)
    if not isinstance(request,dict):raise ValueError('invalid_request')
    command=request.get('cmd')
    if command=='init':result=lab.init(request)
    elif command=='start':result=lab.start()
    elif command=='status':result=lab.status()
    elif command=='call':result=lab.call(request)
    elif command=='register':result=lab.register(request)
    elif command=='hangup':
     own=lab.calls.get(request.get('callId'))
     if not own:raise ValueError('unknown_own_call')
     result={'hungup':lab.uas[own['source']].hangup(own['sipCallId'])}
    elif command=='transfer':result=lab.transfer(request)
    elif command=='pause':result=lab.pause()
    elif command=='sync':result=lab.sync(request)
    elif command=='stop':result=lab.cleanup()
    else:raise ValueError('unknown_command')
    response={'id':request.get('id'),'ok':True,'result':result}
   except Exception as error:
    code=str(error) if isinstance(error,ValueError) and re.fullmatch(r'[a-z_]{1,80}',str(error)) else type(error).__name__
    response={'id':request.get('id') if isinstance(request,dict) else None,'ok':False,'error':code}
    if isinstance(request,dict) and request.get('cmd')=='start':response['details']={'ownLogLines':lab.debug(),'mainUnchanged':lab.main_unchanged()}
   sys.stdout.write(json.dumps(response,separators=(',',':'))+'\n');sys.stdout.flush()
   if isinstance(request,dict) and request.get('cmd')=='stop':break
 finally:lab.cleanup()
if __name__=='__main__':main()
