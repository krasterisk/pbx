"""Local UA protocol tests: real production SIP parser/request code, no sockets/processes.
These byte fixtures exercise the exact Asterisk22 userless UAS Contact shape;
actual call/media evidence remains the coordinator's separate live run.
"""
import ast, json, os, re, socket, struct, tempfile, threading, time, unittest, uuid
from pathlib import Path
from types import SimpleNamespace

SOURCE=Path(__file__).with_name('live-asterisk-lab.py')
module=ast.parse(SOURCE.read_text(encoding='utf8'))
names={'loopback_sip_uri','safe_uri','sdp_media','SipUa','Lab'}
selected=ast.Module(body=[node for node in module.body if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in names],type_ignores=[])
namespace=dict(globals());exec(compile(selected,str(SOURCE),'exec'),namespace)
SipUa,Lab=namespace['SipUa'],namespace['Lab']
loopback_sip_uri,safe_uri=namespace['loopback_sip_uri'],namespace['safe_uri']
PORT=15606

def headers(raw):
 lines=raw.decode().split('\r\n');return lines[0],dict(line.split(': ',1) for line in lines[1:] if ': ' in line)

class FakeSocket:
 def __init__(self):self.sent=[]
 def sendto(self,raw,address):self.sent.append((raw,address))
class FakeMedia(FakeSocket):
 def recvfrom(self,size):raise BlockingIOError()

def ua():
 value=SipUa.__new__(SipUa);value.name='t_live_910001';value.port=30001;value.media_port=42039
 value.lab=SimpleNamespace(ports={'sip':PORT,'rtpStart':42000,'rtpEnd':42039})
 value.socket=FakeSocket();value.media=FakeMedia();value.lock=threading.RLock();value.dialogs={};value.registrations={}
 value.final_contacts=[];value.response_counts={};value.protocol_errors=[]
 value.mode='answer';value.answer_delay=0;value.hold=120;value.rtp_sent=0;value.rtp_received=0;value.invalid_sources=0
 return value

def response(value,call_id,status=200,method='INVITE',contact='<sip:127.0.0.1:%d>'%PORT,cseq=1):
 dialog=value.dialogs[call_id]
 h=[('Via','SIP/2.0/UDP 127.0.0.1:30001;branch='+dialog['branch']),('From',dialog['from']),('To',dialog['to']+';tag=asterisk'),('Call-ID',call_id),('CSeq','%d %s'%(cseq,method))]
 if contact:h.append(('Contact',contact))
 return value.wire('SIP/2.0 %d Response'%status,h,value.sdp() if status==200 and method=='INVITE' else '')

class UriTests(unittest.TestCase):
 def test_accepts_actual_asterisk_userless_contact_and_extracts_header_uri(self):
  self.assertEqual(loopback_sip_uri('<sip:127.0.0.1:15606>',PORT),'sip:127.0.0.1:15606')
  self.assertEqual(loopback_sip_uri('"Asterisk" <sip:user@127.0.0.1:15606;transport=UDP>;expires=600',PORT),'sip:user@127.0.0.1:15606;transport=UDP')
  self.assertEqual(safe_uri('sip:127.0.0.1:15606',PORT),('127.0.0.1',PORT))
 def test_rejects_foreign_ambiguous_and_route_override_targets(self):
  for target in ['sip:127.0.0.1:15607','sip:localhost:15606','sip:user@evil:15606','sip:user@127.0.0.1.evil:15606','sip:evil@127.0.0.1:15606;maddr=evil','sip:user@127.0.0.1:15606;transport=tcp','<sip:evil:15606> <sip:127.0.0.1:15606>','sip:user@127.0.0.1:15606?Route=evil','<sip:127.0.0.1:15606>\r\nContact:evil']:
   with self.subTest(target=target),self.assertRaises(ValueError):loopback_sip_uri(target,PORT)
 def test_old_parser_would_abort_before_ack_on_actual_contact_shape(self):
  self.assertIsNone(re.search(r'sip:[^@;>]+@127\.0\.0\.1(?::(\d+))?','sip:127.0.0.1:15606'))
  self.assertEqual(loopback_sip_uri('<sip:127.0.0.1:15606>',PORT),'sip:127.0.0.1:15606')

class DialogTests(unittest.TestCase):
 def test_final_200_is_acked_media_starts_and_bye_waits_for_actual_response(self):
  value=ua();call=value.originate('100',120);dialog=value.dialogs[call]
  value.incoming(response(value,call),('127.0.0.1',PORT))
  self.assertEqual(dialog['state'],'talking');first,h=headers(value.socket.sent[-1][0]);self.assertEqual(first,'ACK sip:127.0.0.1:15606 SIP/2.0');self.assertEqual(h['CSeq'],'1 ACK');self.assertIn(';tag=asterisk',h['To']);self.assertNotIn(dialog['branch'],h['Via'])
  dialog['remote_media']=('127.0.0.1',42000);value.tick();self.assertGreater(value.rtp_sent,0)
  self.assertTrue(value.hangup(call));self.assertEqual(dialog['state'],'terminating');first,h=headers(value.socket.sent[-1][0]);self.assertEqual(first,'BYE sip:127.0.0.1:15606 SIP/2.0');self.assertEqual(h['CSeq'],'2 BYE')
  value.incoming(response(value,call,method='BYE',cseq=2,contact=''),('127.0.0.1',PORT));self.assertEqual(dialog['state'],'ended');self.assertEqual(dialog['termination_status']['status'],200)
  debug=value.status()['finalInviteContacts'][0];self.assertFalse(debug['hasUser']);self.assertEqual(debug['uri'],'sip:127.0.0.1:15606')
 def test_repeated_final_200_acks_without_reopening_terminating_dialog(self):
  value=ua();call=value.originate('100',120);raw=response(value,call)
  value.incoming(raw,('127.0.0.1',PORT));value.hangup(call);value.incoming(raw,('127.0.0.1',PORT))
  self.assertEqual(value.dialogs[call]['state'],'terminating');self.assertEqual(headers(value.socket.sent[-1][0])[1]['CSeq'],'1 ACK');self.assertEqual(len(value.final_contacts),1)
 def test_cancel_keeps_initial_transaction_uri_cseq_branch_and_ack_of_487(self):
  value=ua();call=value.originate('100',120);dialog=value.dialogs[call];dialog['contact']='sip:user@127.0.0.1:15606'
  value.incoming(response(value,call,status=180,contact=''),('127.0.0.1',PORT));value.hangup(call)
  first,h=headers(value.socket.sent[-1][0]);self.assertEqual(first,'CANCEL sip:100@127.0.0.1:15606 SIP/2.0');self.assertEqual(h['CSeq'],'1 CANCEL');self.assertIn(dialog['branch'],h['Via']);self.assertEqual(h['To'],dialog['to'])
  value.incoming(response(value,call,method='CANCEL',contact=''),('127.0.0.1',PORT));self.assertEqual(dialog['state'],'cancelling')
  value.incoming(response(value,call,status=487,contact=''),('127.0.0.1',PORT));first,h=headers(value.socket.sent[-1][0]);self.assertEqual(first,'ACK sip:100@127.0.0.1:15606 SIP/2.0');self.assertIn(dialog['branch'],h['Via']);self.assertEqual(dialog['state'],'ended')
 def test_final_200_crossing_cancel_is_acked_then_bye_terminates_dialog(self):
  value=ua();call=value.originate('100',120);value.hangup(call);value.incoming(response(value,call),('127.0.0.1',PORT))
  self.assertEqual(value.dialogs[call]['state'],'terminating');self.assertEqual([headers(item[0])[1]['CSeq'] for item in value.socket.sent[-2:]],['1 ACK','2 BYE'])
 def test_bye_retransmits_same_transaction_and_cseq_until_response(self):
  value=ua();call=value.originate('100',120);value.incoming(response(value,call),('127.0.0.1',PORT));value.hangup(call)
  original=value.socket.sent[-1][0];transaction=value.dialogs[call]['transactions'][(2,'BYE')];transaction['last_send']-=1;value.tick()
  self.assertEqual(value.socket.sent[-1][0],original);self.assertEqual(value.dialogs[call]['state'],'terminating')
 def test_rejects_foreign_final_contact_without_ack_or_media(self):
  value=ua();call=value.originate('100',120)
  with self.assertRaises(ValueError):value.incoming(response(value,call,contact='<sip:evil:15606>'),('127.0.0.1',PORT))
  self.assertEqual(len(value.socket.sent),1);self.assertEqual(value.dialogs[call]['state'],'inviting');self.assertEqual(value.protocol_errors[-1]['error'],'non_loopback_contact')
 def test_reinvite_responses_use_current_transaction_and_keep_dialog_tags(self):
  value=ua();h=[('Via','SIP/2.0/UDP 127.0.0.1:15606;branch=z9hG4bKinitial'),('From','<sip:caller@127.0.0.1>;tag=remote'),('To','<sip:t_live_910001@127.0.0.1:30001>'),('Call-ID','own-incoming'),('CSeq','71 INVITE'),('Contact','<sip:127.0.0.1:15606>')]
  value.incoming(value.wire('INVITE sip:t_live_910001@127.0.0.1:30001 SIP/2.0',h,value.sdp()),('127.0.0.1',PORT));value.tick();dialog=value.dialogs['own-incoming'];tag=dialog['local_to']
  changed=[(k,'72 INVITE' if k=='CSeq' else tag if k=='To' else 'SIP/2.0/UDP 127.0.0.1:15606;branch=z9hG4bKnew' if k=='Via' else v) for k,v in h]
  value.incoming(value.wire('INVITE sip:t_live_910001@127.0.0.1:30001 SIP/2.0',changed,value.sdp()),('127.0.0.1',PORT));first,current=headers(value.socket.sent[-1][0]);self.assertEqual(current['CSeq'],'72 INVITE');self.assertEqual(current['To'],tag)
  value.request(dialog,'BYE');self.assertEqual(headers(value.socket.sent[-1][0])[1]['From'],tag)
 def test_debug_redacts_userinfo_and_is_bounded(self):
  value=ua();call=value.originate('100',120);value.incoming(response(value,call,contact='"Lab" <sip:privateuser@127.0.0.1:15606;transport=UDP>;expires=600'),('127.0.0.1',PORT))
  self.assertNotIn('privateuser',json.dumps(value.status()));self.assertTrue(value.status()['finalInviteContacts'][0]['hasUser'])

class OwnMessageTests(unittest.TestCase):
 def test_only_owned_exact_messages_tail_is_bounded_and_redacted(self):
  with tempfile.TemporaryDirectory() as directory:
   os.makedirs(os.path.join(directory,'log'));path=os.path.join(directory,'log','messages')
   Path(path).write_text('\n'.join('line%d secret=private-secret '+directory for i in range(40)),encoding='utf8')
   lab=Lab();lab.directory=directory;lab.ami_secret='private-secret';lab.contained=lambda candidate:os.path.abspath(candidate)==os.path.abspath(path)
   lines=lab.own_messages();self.assertEqual(len(lines),20);self.assertNotIn('private-secret',''.join(lines));self.assertNotIn(directory,''.join(lines))
   lab.contained=lambda candidate:False;self.assertEqual(lab.own_messages(),[])

if __name__=='__main__':unittest.main()
