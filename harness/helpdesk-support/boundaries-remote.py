import subprocess,time,json,re
from pathlib import Path
root=Path(__file__).resolve().parent
compose=['docker','compose','-p','helpdesk-v4-lab-r9','-f',str(root/'compose.yaml'),'exec','-T','asterisk','asterisk','-rx']
source=(root/'asterisk/krasterisk/routes/extensions_support_golden2.conf').read_text()
lines=source.splitlines();start=next(i for i,line in enumerate(lines) if 'Set(__WT_' in line)
uid=re.search(r'Set\(__WT_(\d+)=0\)',lines[start])[1]
stop=next(i for i in range(start+1,len(lines)) if 'NoOp(Calendar interval checked)' in lines[i])
block='\n'.join(lines[start:stop+1])
assert '08:00-21:59' in block and 'Asia/Krasnoyarsk' in block and 'GotoIfTime' in block
text='[support-lab-boundary]\n'
for key,at in [('before','07:59:59'),('start','08:00:00'),('last','21:59:59'),('end','22:00:00')]:
 text+='exten => '+key+',1,Answer()\nsame => n,Set(TESTTIME()=2026/10/12 '+at+' Asia/Krasnoyarsk)\n'+block+'\nsame => n,Set(DB(support_lab/'+key+')=${WT_'+uid+'})\nsame => n,Hangup()\n'
(root/'asterisk/krasterisk/routes/lab_calendar_boundaries.conf').write_text(text)
def cli(cmd):return subprocess.check_output(compose+[cmd],text=True,timeout=20)
cli('dialplan reload');cli('database deltree support_lab');result={}
for key,expected in [('before',0),('start',1),('last',1),('end',0)]:
 cli('channel originate Local/'+key+'@support-lab-boundary/n application Wait 10')
 for attempt in range(60):
  raw=cli('database get support_lab '+key)
  if 'Value:' in raw:break
  time.sleep(.05)
 assert 'Value: '+str(expected) in raw,(key,raw)
 result[key]=expected
print(json.dumps({'real_Asterisk_TESTTIME':'pass','deployed_inline_calendar':True,'boundaries':result,'external_calls':0}))
