const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const remoteScript=String.raw`
import os,sys,re,json,glob,shutil,time,subprocess,socket,urllib.request,urllib.error
report={'scope':'D6-LIVE-read-only-capability-reconnaissance','errors':[],'mutations':{'calls':False,'config':False,'database':False,'service':False,'install':False,'download':False,'newProcessOrListener':False}}
def command(args,timeout=5):
 try:
  p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=timeout,text=True)
  return p.stdout[:131072] if p.returncode==0 else None
 except Exception:return None
def read(file,limit=262144):
 try:
  with open(file,encoding='utf8',errors='replace') as f:return f.read(limit)
 except Exception:return ''
def conf(file):
 result={};section=None
 for line in read(file).splitlines():
  if line.strip().startswith((';','#')):continue
  m=re.match(r'^\s*\[([^\]]+)\]',line)
  if m:section=m.group(1);result.setdefault(section,{});continue
  if section and '=' in line:
   k,v=line.split('=',1);result[section][k.strip().lower()]=v.strip().split(' ;',1)[0].strip()
 return result
def bool_value(value):return str(value).lower() in ('yes','true','1','on','enabled')
def scalar_version(raw):
 return next((x.strip()[:160] for x in (raw or '').splitlines() if re.match(r'^(?:v?\d+\.\d+|Asterisk |SIPp |PJSUA |ffmpeg version)',x)),None)
def cli(text):return command(['/usr/sbin/asterisk','-rx',text],6) or ''
# CWD/entry paths and allowlisted version metadata only; never return raw cmdlines or environment values.
processes=[];roots=set();asterisk_pids=[]
for entry in os.listdir('/proc'):
 if not entry.isdigit():continue
 try:
  cmd=open('/proc/'+entry+'/cmdline','rb').read(65536).decode(errors='replace').split('\0')
  exe=os.path.realpath('/proc/'+entry+'/exe');cwd=os.path.realpath('/proc/'+entry+'/cwd')
  basename=os.path.basename(exe)
  if basename=='asterisk':asterisk_pids.append(int(entry))
  if basename not in ('node','nodejs') and not any('PM2' in part for part in cmd[:3]):continue
  scripts=[part for part in cmd[1:6] if part.startswith('/') and re.search(r'\.(?:c?js|mjs)$',part) and '?' not in part and len(part)<256]
  status=read('/proc/'+entry+'/status',8192)
  rss=re.search(r'^VmRSS:\s+(\d+)\s+kB',status,re.M)
  processes.append({'runtime':basename,'executable':exe,'cwd':cwd,'entryScripts':scripts[:2],'rssBytes':int(rss.group(1))*1024 if rss else None})
  if cwd.startswith(('/opt/','/srv/','/var/www/','/root/','/home/')):roots.add(cwd)
  for script in scripts:
   current=os.path.dirname(script)
   for _ in range(3):
    if os.path.isfile(os.path.join(current,'package.json')):roots.add(current)
    current=os.path.dirname(current)
 except Exception:pass
report['runtime']={'nodeVersion':scalar_version(command(['node','--version'])),'npmVersion':scalar_version(command(['npm','--version'])),'nodeProcesses':processes[:20],
 'tools':{name:shutil.which(name) for name in ['node','npm','python3','sipp','pjsua','pjsua2','ffmpeg','sox','curl','docker']}}
containers=command(['docker','ps','--format','{{.Names}}\t{{.Image}}\t{{.Status}}']) or ''
report['runtime']['containers']=[{'name':parts[0],'image':parts[1],'status':parts[2]} for parts in (line.split('\t') for line in containers.splitlines()) if len(parts)==3][:16]
units=command(['systemctl','list-units','--type=service','--state=running','--no-legend','--no-pager']) or ''
report['runtime']['serviceNames']=[line.split()[0] for line in units.splitlines() if re.search(r'asterisk|node|pm2|krasterisk|mysql|maria|nginx|docker',line,re.I)][:20]
# Bounded discovery of existing app dirs. Exclude dependency trees and repository metadata.
for base in ['/opt','/srv','/var/www','/root','/home']:
 visited=0
 for directory,children,files in os.walk(base):
  visited+=1
  relative=os.path.relpath(directory,base);depth=0 if relative=='.' else relative.count('/')+1
  children[:]=[name for name in children if name not in ['node_modules','.git','.cache','.npm','.pm2','.nvm','.local','.rustup','.cargo','.config','.ssh','.codex','logs']]
  if depth>=4 or visited>180:children[:]=[]
  if 'package.json' in files:roots.add(directory)
  if visited>180:break
packages=[];ai_keys=set();app_paths=[]
key_pattern=re.compile(r'^(?:ARI_|AMI_|AI_|VOICE_|OLLAMA_|OPENAI_|ANTHROPIC_|YANDEX_|DEEPGRAM_|ELEVENLABS_|GROQ_|STT_|TTS_)')
for directory in sorted(roots)[:40]:
 try:
  p=json.loads(read(os.path.join(directory,'package.json'),65536))
  name=p.get('name');version=p.get('version')
  if not isinstance(name,str) or len(name)>160:continue
  dashboard=[];ai_modules=[]
  for relative in ['dist/modules/dashboard/dashboard.controller.js','dist/src/modules/dashboard/dashboard.controller.js','src/modules/dashboard/dashboard.controller.ts','packages/backend/src/modules/dashboard/dashboard.controller.ts','packages/backend/dist/modules/dashboard/dashboard.controller.js']:
   full=os.path.join(directory,relative)
   if os.path.isfile(full):
    body=read(full,131072);dashboard.append({'path':full,'apiOverviewMarker':bool(re.search(r'overview',body)),'dashboardControllerMarker':'DashboardController' in body})
  for relative in ['dist/modules/ai-voice','dist/modules/voice-robots','src/modules/ai-voice','src/modules/voice-robots','packages/backend/src/modules/ai-voice','packages/backend/src/modules/voice-robots']:
   if os.path.isdir(os.path.join(directory,relative)):ai_modules.append(relative)
  packages.append({'path':directory,'name':name,'version':version if isinstance(version,str) and len(version)<80 else None,'dashboardControllers':dashboard,'aiModulePaths':ai_modules})
  app_paths.append(directory)
  for relative in ['.env','packages/backend/.env','backend/.env','.env.production']:
   for line in read(os.path.join(directory,relative)).splitlines():
    m=re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$',line)
    if m and key_pattern.match(m.group(1)) and m.group(2).strip().strip('"').strip("'"):ai_keys.add(m.group(1))
 except Exception:pass
# Process runtime environment names may differ from deployment files; no values returned.
for entry in os.listdir('/proc'):
 if not entry.isdigit():continue
 try:
  exe=os.path.basename(os.path.realpath('/proc/'+entry+'/exe'))
  if exe not in ('node','nodejs'):continue
  raw=open('/proc/'+entry+'/environ','rb').read(262144).decode(errors='replace')
  for item in raw.split('\0'):
   if '=' in item:
    name,value=item.split('=',1)
    if key_pattern.match(name) and value:ai_keys.add(name)
 except Exception:pass
report['deployment']={'packages':packages,'dashboardRouteFilesFound':any(p['dashboardControllers'] for p in packages),'newDashboardDeploymentVerified':False}
# Asterisk executable/config capability and existing logging sinks: never query or return call rows.
asterisk_conf=conf('/etc/asterisk/asterisk.conf');dirs=asterisk_conf.get('directories',{})
module_dir=dirs.get('astmoddir','/usr/lib/asterisk/modules');data_dir=dirs.get('astdatadir',dirs.get('astvarlibdir','/var/lib/asterisk'))
log_dir=dirs.get('astlogdir','/var/log/asterisk');spool_dir=dirs.get('astspooldir','/var/spool/asterisk')
required=['chan_pjsip.so','chan_local.so','res_pjsip.so','res_pjsip_session.so','res_pjsip_endpoint_identifier_ip.so','res_pjsip_outbound_authenticator_digest.so','res_rtp_asterisk.so','res_ari.so','res_ari_channels.so','app_dial.so','app_playback.so','app_voicemail.so','app_answer.so','app_wait.so','app_stack.so','app_stasis.so','pbx_config.so','cdr_csv.so','cdr_custom.so','cel_custom.so','codec_ulaw.so','codec_alaw.so','format_wav.so','format_pcm.so']
module_files={name:os.path.isfile(os.path.join(module_dir,name)) for name in required}
def loaded_modules(filter):
 raw=cli('module show like '+filter)
 return [{'name':m.group(1),'running':'Running' in line} for line in raw.splitlines() for m in [re.match(r'^([a-z][a-z0-9_]*\.so)\s',line)] if m][:40]
logging={}
for category in ['cdr','cel']:
 raw=cli(category+' show status')
 logging[category]={'statusCommandAvailable':bool(raw) and 'No such command' not in raw,'enabled':bool(re.search(r'logging\s*:?\s*enabled|logging\s*:\s*yes',raw,re.I)),
  'loadedBackends':loaded_modules(category),'configuredFiles':[]}
 for name in (['cdr.conf','cdr_csv.conf','cdr_custom.conf','cdr_adaptive_odbc.conf','cdr_odbc.conf'] if category=='cdr' else ['cel.conf','cel_custom.conf','cel_odbc.conf']):
  file='/etc/asterisk/'+name
  if not os.path.isfile(file):continue
  c=conf(file)
  safe=[]
  for section,values in c.items():
   safe.append({'sectionKind':'general' if section=='general' else 'mapping' if section=='mappings' else 'backend','keyNames':sorted(values)[:32],
    'enabled':bool_value(values['enable']) if 'enable' in values else bool_value(values['enabled']) if 'enabled' in values else None,
    'tables':[v for k,v in values.items() if k=='table' and re.fullmatch(r'[A-Za-z0-9_]{1,64}',v)],
    'csvBasenames':[os.path.basename(k) for k in values if section=='mappings' and re.fullmatch(r'[A-Za-z0-9_./-]{1,128}',k)]})
  logging[category]['configuredFiles'].append({'path':file,'sections':safe})
 for subdir in (['cdr-csv','cdr-custom'] if category=='cdr' else ['cel-custom']):
  sink=os.path.join(log_dir,subdir,'Master.csv')
  logging[category].setdefault('existingCsvSinks',[]).append({'path':sink,'exists':os.path.isfile(sink),'readRows':False})
manager=conf('/etc/asterisk/manager.conf').get('general',{});http=conf('/etc/asterisk/http.conf').get('general',{})
active=cli('core show channels count');counts=re.findall(r'^(\d+) active (channels|calls)',active,re.M)
helptext=command(['/usr/sbin/asterisk','-h']) or ''
settings=cli('core show settings')
report['asterisk']={'version':scalar_version(command(['/usr/sbin/asterisk','-V'])),'binary':'/usr/sbin/asterisk','runningProcessCount':len(asterisk_pids),'activeCounts':dict((name,int(number)) for number,name in counts),
 'directories':{'modules':module_dir,'data':data_dir,'logs':log_dir,'spool':spool_dir,'config':'/etc/asterisk'},'moduleFiles':module_files,
 'loadedPjsipModules':loaded_modules('pjsip'),'loadedAriModules':loaded_modules('ari'),
 'alternateConfigFlagAvailable':bool(re.search(r'-C\s+',helptext)),'foregroundFlagAvailable':'-f' in helptext,
 'manager':{'generalFilePresent':bool(manager),'enabled':bool_value(manager.get('enabled','no')),'configuredPort':int(manager.get('port','5038')) if manager.get('port','5038').isdigit() else None},
 'httpAri':{'enabled':bool_value(http.get('enabled','no')),'configuredPort':int(http.get('bindport','8088')) if http.get('bindport','8088').isdigit() else None},'logging':logging}
sounds=[]
for sound_root in sorted(set([os.path.join(data_dir,'sounds'),'/var/lib/asterisk/sounds','/usr/share/asterisk/sounds'])):
 if not os.path.isdir(sound_root):continue
 known=[]
 for basename in ['hello-world','demo-congrats','beep','vm-greet','silence/1']:
  for prefix in ['', 'en/', 'en_US/', 'ru/']:
   found=glob.glob(os.path.join(sound_root,prefix+basename+'.*'))[:4]
   if found:known.append({'name':prefix+basename,'formats':sorted(set(os.path.splitext(f)[1][1:] for f in found))})
 sounds.append({'path':sound_root,'knownFixtures':known[:16]})
report['asterisk']['sounds']=sounds
channeltypes=cli('core show channeltypes');answer=cli('core show application Answer');wait=cli('core show application Wait')
report['asterisk']['builtInCapabilities']={'localChannel':bool(re.search(r'^Local\s',channeltypes,re.M)),'answerApplication':'No such command' not in answer and 'Your application' not in answer and bool(re.search(r'Answer',answer)),'waitApplication':'No such command' not in wait and bool(re.search(r'Wait',wait))}
report['asterisk']['installedModuleDependencyNames']={name:os.path.isfile(os.path.join(module_dir,name)) for name in ['res_pjproject.so','res_sorcery_config.so','res_sorcery_memory.so','res_sorcery_astdb.so','res_sorcery_realtime.so','res_pjsip_authenticator_digest.so','res_pjsip_endpoint_identifier_user.so','res_pjsip_registrar.so','res_pjsip_transport_websocket.so','res_pjsip_mwi.so','res_pjsip_pubsub.so','res_pjsip_nat.so','res_pjsip_caller_id.so','res_pjsip_dtmf_info.so','res_pjsip_header_funcs.so','res_http_websocket.so','res_crypto.so','res_timing_timerfd.so','func_channel.so','func_cdr.so','func_strings.so','app_cdr.so','app_celgenuserevent.so','app_senddtmf.so','app_transfer.so']}
# Read port inventory rather than binding new sockets; no generated listener/process.
ports={'tcp':set(),'udp':set()}
for name in ['tcp','tcp6','udp','udp6']:
 for line in read('/proc/net/'+name).splitlines()[1:]:
  fields=line.split()
  try:ports[name[:3]].add(int(fields[1].split(':')[1],16))
  except Exception:pass
candidate={'amiTcp':15538,'sipUdp':15606,'ariTcp':15808,'rtpUdpStart':42000,'rtpUdpEnd':42039}
report['isolatedInstance']={'started':False,'proposedPorts':candidate,'portsAppearUnused':{'ami':candidate['amiTcp'] not in ports['tcp'],'sip':candidate['sipUdp'] not in ports['udp'],'ari':candidate['ariTcp'] not in ports['tcp'],'rtpRange':not any(x in ports['udp'] for x in range(candidate['rtpUdpStart'],candidate['rtpUdpEnd']+1))},
 'wouldNeed':'Unique /tmp UUID config/run/spool/log/data directories, foreground -C own asterisk.conf, modules autoload=no, loopback SIP/AMI/ARI and distinct RTP; no production module/config/database bindings',
 'cdrCelStrategy':{'cdr':'Installed cdr_custom.so with own explicit field mapping into own astlogdir/cdr-custom/Master.csv; generated IDs only (cdr_csv.so is absent)' ,'cel':'Explicit cel_custom.so mapping to own astlogdir/cel-custom/Master.csv with LINKEDID_END/ANSWER/BRIDGE_ENTER events','databaseWrites':'None: omit cdr/cel ODBC, PGSQL and MySQL backend modules; return only own generated rows','sounds':'Reuse installed system sounds read-only or generated tiny own PCM/WAV fixture; own voicemail spool only'},
 'secondProcessFeasibility':'Capability estimate only; not launch-verified'}
# Availability means local listeners/registered integration capability. No paid provider inference requests.
apps=cli('ari show apps')
known_apps=['krasterisk','krasterisk_ai_voice','krasterisk_autodial','voice_robots']
known_present=[name for name in known_apps if re.search(r'\b'+re.escape(name)+r'\b',apps)]
ollama=False;model_count=None
try:
 with urllib.request.urlopen('http://127.0.0.1:11434/api/tags',timeout=2) as response:
  data=json.loads(response.read(65536));ollama=True;model_count=len(data.get('models',[]))
except Exception:pass
report['ai']={'configuredKeyNames':sorted(ai_keys),'deployedAiModulePathsFound':any(p['aiModulePaths'] for p in packages),'ariAppsCommandAvailable':bool(apps) and 'No such command' not in apps,'knownRegisteredAriApps':known_present,
 'ollamaLocalAvailable':ollama,'ollamaLocalModelCount':model_count,'externalProviderInferenceInvoked':False,'externalProviderAvailability':'Unverified: credentials are not returned and inference is not called; tenant providers may be DB managed'}
mem={}
for line in read('/proc/meminfo',32768).splitlines():
 try:k,v=line.split(':',1);mem[k]=int(v.strip().split()[0])*1024
 except Exception:pass
capacity={'memoryTotalBytes':mem.get('MemTotal'),'memoryAvailableBytes':mem.get('MemAvailable'),'swapFreeBytes':mem.get('SwapFree'),'cpuCount':os.cpu_count(),'loadAverage':list(os.getloadavg())}
for label,directory in [('root','/'),('tmp','/tmp')]:
 st=os.statvfs(directory);capacity[label+'AvailableBytes']=st.f_bavail*st.f_frsize
rss=[]
for pid in asterisk_pids:
 status=read('/proc/'+str(pid)+'/status',8192);m=re.search(r'^VmRSS:\s+(\d+)\s+kB',status,re.M)
 if m:rss.append(int(m.group(1))*1024)
capacity['productionAsteriskRssBytes']=sum(rss);report['capacity']=capacity
report['isolatedInstance']['minimalLocalCsvInstanceLikelyFits']=bool(capacity['memoryAvailableBytes'] and capacity['memoryAvailableBytes']>192*1024*1024 and (module_files['cdr_custom.so'] or module_files['cdr_csv.so']) and module_files['cel_custom.so'])
print(json.dumps(report,separators=(',',':')))
`;
const ssh=spawn('C:/Windows/System32/OpenSSH/ssh.exe',['-i','C:/Users/Professional/.ssh/aipbx_ollama_audit','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8','root@ipbx.krasterisk.ru','python3','-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
let output='',errors='',bytes=0;ssh.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024){ssh.kill();return;}output+=chunk.toString();});ssh.stderr.on('data',chunk=>{errors+=chunk.toString();if(errors.length>8192)errors=errors.slice(0,8192);});ssh.stdin.end(remoteScript);const timeout=setTimeout(()=>ssh.kill(),110000);
ssh.on('close',code=>{clearTimeout(timeout);const reportFile=path.join(__dirname,'live-capabilities-check.json'),logFile=path.join(__dirname,'live-capabilities-check.log');try{if(code!==0)throw new Error('ssh_failed_'+code);const report=JSON.parse(output.trim());report.checkedAt=new Date().toISOString();report.remoteHost='ipbx.krasterisk.ru';report.gates={readOnlyCapabilities:'pass',isolatedAsteriskLaunch:'pending_not_started',liveCalls:'pending_no_calls_invoked',newDashboardDeployment:'pending_not_deployed',paidAiFlows:'pending_no_provider_inference'};fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');const lines=[`Checked ${report.checkedAt}`,`Host ${report.remoteHost}`,`Asterisk ${report.asterisk.version}`,`Runtime ${JSON.stringify({node:report.runtime.nodeVersion,npm:report.runtime.npmVersion,tools:report.runtime.tools})}`,`Deployment ${JSON.stringify(report.deployment)}`,`Logging ${JSON.stringify(report.asterisk.logging)}`,`Isolation ${JSON.stringify(report.isolatedInstance)}`,`AI key names/capability only ${JSON.stringify(report.ai)}`,`Capacity ${JSON.stringify(report.capacity)}`,`Gates ${JSON.stringify(report.gates)}`,'Read-only; no calls, config, service, database writes, installs, listener or process launched.'];fs.writeFileSync(logFile,lines.join('\n')+'\n');console.log(lines.join('\n'));}catch(error){const safe={checkedAt:new Date().toISOString(),status:'failed',errorType:error.name,message:String(error.message).slice(0,100),sshExitCode:code,stderrPresent:!!errors};fs.writeFileSync(logFile,JSON.stringify(safe)+'\n');console.error('Capability probe failed; sanitized evidence saved.');process.exitCode=1;}});
