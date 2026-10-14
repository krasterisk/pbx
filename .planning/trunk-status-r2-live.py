#!/usr/bin/env python3
"""Disposable outbound registration fixture atop the existing isolated PBX lab.
No production configuration, registration, database, credentials or routes used.
Base lab source is supplied on stdin and executed with a non-main module name.
"""
import base64, hashlib, json, os, re, signal, socket, sys, threading, uuid

scope = {'__name__': 'isolated_registration_base'}
exec(compile(base64.b64decode(sys.stdin.buffer.readline()), '<isolated-pbx-base>', 'exec'), scope)
BaseLab = scope['Lab']
IDS = ['t_good_910001', 't_bad_910001', 't_other_910002']


class Registrar:
 def __init__(self):
  self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  self.sock.bind(('127.0.0.1', 0)); self.sock.settimeout(.1)
  self.port = self.sock.getsockname()[1]
  self.secret = uuid.uuid4().hex; self.nonce = uuid.uuid4().hex
  self.closed = False; self.accept = False
  self.counts = {key: {'register': 0, 'unregister': 0, 'accepted': 0, 'options': 0} for key in IDS}
  self.thread = threading.Thread(target=self.run, daemon=True); self.thread.start()

 def run(self):
  while not self.closed:
   try: wire, address = self.sock.recvfrom(32768)
   except socket.timeout: continue
   except OSError: return
   if address[0] != '127.0.0.1': continue
   lines = wire.decode('utf8', 'replace').split('\r\n')
   headers = {}
   for line in lines[1:]:
    if ':' in line:
     key, value = line.split(':', 1); headers[key.lower()] = value.strip()
   method = lines[0].split(' ')[0]
   found = re.search(r'sip:(t_[a-z]+_91000[12])@', headers.get('from', ''))
   name = found.group(1) if found else None
   if method == 'OPTIONS':
    status, phrase = 200, 'OK'
    if name in self.counts: self.counts[name]['options'] += 1
    extra = []
   elif method == 'REGISTER' and name in IDS:
    self.counts[name]['unregister' if headers.get('expires') == '0' else 'register'] += 1
    auth = dict(re.findall(r'(\w+)="([^"]*)"', headers.get('authorization', '')))
    if not auth:
     status, phrase = 401, 'Unauthorized'
     extra = [('WWW-Authenticate', 'Digest realm="registration-live",nonce="%s",algorithm=MD5' % self.nonce)]
    else:
     ha1 = hashlib.md5(('%s:registration-live:%s' % (name, self.secret)).encode()).hexdigest()
     ha2 = hashlib.md5(('REGISTER:' + auth.get('uri', '')).encode()).hexdigest()
     expected = hashlib.md5(('%s:%s:%s' % (ha1, self.nonce, ha2)).encode()).hexdigest()
     good = auth.get('response') == expected
     # Accept removal of a registration even when provider policy rejects its
     # new REGISTER. PJSIPRegister first unregisters; a 403 for that removal
     # prevents Asterisk from reaching the subsequent registration attempt.
     allowed = name != 't_bad_910001' or headers.get('expires') == '0'
     status, phrase = (200, 'OK') if good and self.accept and allowed else (403, 'Forbidden')
     extra = []
     if status == 200:
      self.counts[name]['accepted'] += 1
      extra = [('Contact', headers.get('contact', '')), ('Expires', headers.get('expires', '300'))]
   else: continue
   response = [('Via', headers.get('via', '')), ('From', headers.get('from', '')), ('To', headers.get('to', '') + ';tag=registration-live'), ('Call-ID', headers.get('call-id', '')), ('CSeq', headers.get('cseq', ''))] + extra + [('Content-Length', '0')]
   packet = ('SIP/2.0 %d %s\r\n' % (status, phrase) + ''.join('%s: %s\r\n' % item for item in response) + '\r\n').encode()
   try: self.sock.sendto(packet, address)
   except OSError: pass

 def close(self):
  self.closed = True; self.sock.close(); self.thread.join(timeout=1)


class RegistrationLab(BaseLab):
 def build_config(self, user, secret, ari_secret):
  super().build_config(user, secret, ari_secret)
  self.registrar = Registrar()
  target = os.path.join(self.directory, 'cfg', 'pjsip.conf')
  if not self.contained(target): raise ValueError('fixture_containment_failed')
  with open(target, 'a', encoding='utf8') as handle:
   for name in IDS:
    handle.write('\n[%s]\ntype=endpoint\ntransport=lab-loopback\ncontext=internal\ndisallow=all\nallow=ulaw\naors=%s\n[%s]\ntype=aor\ncontact=sip:%s@127.0.0.1:%d\nqualify_frequency=5\n[%s-auth]\ntype=auth\nauth_type=userpass\nusername=%s\npassword=%s\n[%s]\ntype=registration\ntransport=lab-loopback\noutbound_auth=%s-auth\nserver_uri=sip:127.0.0.1:%d\nclient_uri=sip:%s@127.0.0.1:%d\nretry_interval=3600\nforbidden_retry_interval=3600\nfatal_retry_interval=0\nmax_retries=1\nexpiration=300\n' % (name, name, name, name, self.registrar.port, name, name, self.registrar.secret, name, name, self.registrar.port, name, self.registrar.port))
   handle.write('\n[t_nocontact_910001]\ntype=endpoint\ntransport=lab-loopback\ncontext=internal\ndisallow=all\nallow=ulaw\naors=t_nocontact_910001\n[t_nocontact_910001]\ntype=aor\nmax_contacts=1\n')
   handle.write('\n[t_noqual_910001]\ntype=endpoint\ntransport=lab-loopback\ncontext=internal\ndisallow=all\nallow=ulaw\naors=t_noqual_910001\n[t_noqual_910001]\ntype=aor\ncontact=sip:t_noqual_910001@127.0.0.1:%d\nqualify_frequency=0\n' % self.registrar.port)

 def state(self):
  registrations = {}
  for name in IDS:
   rows = self.cli('pjsip show registration ' + name)
   # Base cli returns command output text; no credential/config text is emitted.
   found = re.search(r'\b(Registered|Rejected|Unregistered|Stopped)\b', str(rows))
   registrations[name] = found.group(1) if found else 'Unknown'
  aors = [{'id': name, 'contact': 'sip:%s@127.0.0.1:%d' % (name, self.registrar.port), 'qualify_frequency': 5} for name in IDS]
  aors += [{'id': 't_nocontact_910001', 'contact': '', 'qualify_frequency': 0},
           {'id': 't_noqual_910001', 'contact': 'sip:t_noqual_910001@127.0.0.1:%d' % self.registrar.port, 'qualify_frequency': 0}]
  return {'registrations': registrations, 'requests': self.registrar.counts, 'aors': aors, 'mainUnchanged': self.main_unchanged()}

 def cleanup(self):
  result = super().cleanup()
  if hasattr(self, 'registrar'):
   port = self.registrar.port; self.registrar.close()
   probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
   try: probe.bind(('127.0.0.1', port)); result['registrarPortReleased'] = True
   except OSError: result['registrarPortReleased'] = False
   finally: probe.close()
  return result


lab = RegistrationLab()
def interrupted(signum, frame): lab.cleanup(); raise SystemExit(0)
for signum in [signal.SIGTERM, signal.SIGINT, signal.SIGHUP]: signal.signal(signum, interrupted)
try:
 for line in sys.stdin:
  request = {}
  try:
   if len(line) > 65536: raise ValueError('request_budget_exceeded')
   request = json.loads(line); command = request.get('cmd')
   if command == 'init': result = lab.init(request)
   elif command == 'start': result = lab.start()
   elif command == 'status': result = lab.state()
   elif command == 'accept': lab.registrar.accept = True; result = {'fixtureAccepting': True}
   elif command == 'stop': result = lab.cleanup()
   else: raise ValueError('unknown_fixture_command')
   print(json.dumps({'id': request.get('id'), 'result': result}), flush=True)
   if command == 'stop': break
  except Exception as error:
   print(json.dumps({'id': request.get('id'), 'ok': False, 'error': type(error).__name__}), flush=True)
finally: lab.cleanup()
