const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ts = require('typescript');
const remoteScript = String.raw`
import os, re, glob, json, socket, time, subprocess, shutil, urllib.request, urllib.error
from collections import Counter
report = {'scope': 'actual-source-read-only', 'dashboardCodeDeployed': False, 'actions': [], 'errors': []}

def run(args, timeout=8):
    try:
        proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=timeout, text=True)
        return proc.stdout[:100000] if proc.returncode == 0 else None
    except Exception:
        return None

# Read credentials solely in process memory. Their values and account names are never returned.
config_files, config_parts, seen = [], [], set()
def load_manager(filename):
    filename = os.path.realpath(filename)
    if filename in seen or len(seen) >= 32 or not filename.startswith('/etc/asterisk/'):
        return
    seen.add(filename)
    try:
        raw = open(filename, encoding='utf-8', errors='replace').read(262144)
        config_files.append(filename)
        for line in raw.splitlines():
            include = re.match(r'^\s*#(?:try)?include\s+["<]?([^">\s]+)', line)
            if include:
                pattern = include.group(1)
                if not os.path.isabs(pattern): pattern = os.path.join(os.path.dirname(filename), pattern)
                for child in glob.glob(pattern)[:32]: load_manager(child)
            else: config_parts.append(line)
    except Exception:
        pass
load_manager('/etc/asterisk/manager.conf')
sections, current = {}, None
for line in config_parts:
    if line.strip().startswith((';', '#')): continue
    match = re.match(r'^\s*\[([^\]]+)\](?:\(([^)]*)\))?', line)
    if match:
        current = match.group(1)
        sections.setdefault(current, {'template': '!' in (match.group(2) or ''), 'inherits': (match.group(2) or '')})
    elif current and '=' in line:
        key, value = line.split('=', 1)
        sections[current][key.strip().lower()] = value.strip().split(' ;', 1)[0].strip()

# Existing deployment env names are useful capability evidence. Values remain private.
env_files, env_values = [], {}
patterns = ['/opt/*/.env', '/opt/*/*/.env', '/opt/*/*/*/.env', '/srv/*/.env', '/srv/*/*/.env',
            '/var/www/*/.env', '/var/www/*/*/.env', '/root/*/.env', '/root/*/*/.env', '/home/*/*/.env']
for pattern in patterns:
    for filename in glob.glob(pattern)[:40]:
        if len(env_files) >= 40: break
        try:
            raw = open(filename, encoding='utf-8', errors='replace').read(262144)
            env_files.append(filename)
            for line in raw.splitlines():
                match = re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$', line)
                if match: env_values[match.group(1)] = match.group(2).strip().strip('"').strip("'")
        except Exception: pass

candidates = []
if env_values.get('AMI_LOGIN') and env_values.get('AMI_SECRET'):
    candidates.append((env_values['AMI_LOGIN'], env_values['AMI_SECRET']))
for name, values in sections.items():
    if name == 'general' or values.get('template'): continue
    inherited = {}
    for parent in str(values.get('inherits', '')).split(','):
        inherited.update(sections.get(parent.strip(), {}))
    inherited.update(values)
    if inherited.get('secret') and str(inherited.get('read', '')).lower() not in ('', 'none'):
        candidate = (name, inherited['secret'])
        if candidate not in candidates: candidates.append(candidate)
candidates.sort(key=lambda item: (item[0] not in ('krasterisk', 'admin', 'aipbx'), ))
general = sections.get('general', {})
port = int(general.get('port', '5038'))
report['ami'] = {'credentialCandidatesFound': len(candidates), 'managerFilesRead': len(config_files), 'connected': False, 'authenticated': False}

class Ami:
    def __init__(self):
        self.sock = socket.create_connection(('127.0.0.1', port), timeout=5)
        self.sock.settimeout(0.5)
        self.buffer = b''
        self.bytes = 0
    def send(self, fields):
        frame = ''.join(str(k) + ': ' + str(v) + '\r\n' for k,v in fields.items()) + '\r\n'
        self.sock.sendall(frame.encode())
    def frame(self, deadline):
        while time.monotonic() < deadline:
            if b'\r\n\r\n' in self.buffer:
                data, self.buffer = self.buffer.split(b'\r\n\r\n', 1)
                result = {}
                for line in data.decode('utf-8', errors='replace').split('\r\n'):
                    if ': ' in line:
                        key, value = line.split(': ',1)
                        result[key.lower()] = value
                return result
            try:
                data = self.sock.recv(65536)
                if not data: return None
                self.bytes += len(data)
                if self.bytes > 32*1024*1024: raise RuntimeError('AMI_BUDGET')
                self.buffer += data
            except socket.timeout: pass
        return None
    def close(self):
        self.sock.close()

ami = None
try:
    for username, secret in candidates[:5]:
        client = Ami()
        report['ami']['connected'] = True
        loginid = 'dashboard-source-login'
        client.send({'Action':'Login','Username':username,'Secret':secret,'Events':'off','ActionID':loginid})
        deadline = time.monotonic() + 5
        accepted = False
        while time.monotonic() < deadline:
            item = client.frame(deadline)
            if item is None: break
            if item.get('actionid') == loginid:
                accepted = item.get('response','').lower() == 'success'
                break
        if accepted:
            ami = client
            report['ami']['authenticated'] = True
            break
        client.close()
    if ami:
        actions = [('CoreShowChannels','coreshowchannel','coreshowchannelscomplete'),
                   ('PJSIPShowEndpoints','endpointlist','endpointlistcomplete'),
                   ('PJSIPShowContacts','contactlist','contactlistcomplete'),
                   ('PJSIPShowRegistrationsOutbound','outboundregistrationdetail','outboundregistrationdetailcomplete')]
        for index, (action, event, complete) in enumerate(actions):
            start = time.monotonic()
            actionid = 'dashboard-source-' + str(index)
            ami.send({'Action':action,'ActionID':actionid})
            deadline = time.monotonic() + 15
            count, fields, complete_seen, response, complete_fields = 0, set(), False, None, set()
            observed_events = Counter()
            while time.monotonic() < deadline:
                item = ami.frame(deadline)
                if item is None: break
                if item.get('actionid') != actionid: continue
                if 'response' in item:
                    response = item['response']
                    if response.lower() == 'error': break
                name = item.get('event','').lower()
                if name: observed_events[name] += 1
                if name == event:
                    count += 1
                    fields.update(item.keys())
                    if count > 100000: break
                if name == complete:
                    complete_seen = True
                    complete_fields.update(item.keys())
                    break
            report['actions'].append({'action':action, 'response':response, 'rows':count,
                'complete':complete_seen,'timeout':not complete_seen and response != 'Error',
                'elapsedMs':round((time.monotonic()-start)*1000,1), 'rowFields':sorted(fields),
                'completeFields':sorted(complete_fields),'eventNames':dict(observed_events)})
        ami.send({'Action':'Logoff','ActionID':'dashboard-source-logoff'})
except Exception as error:
    report['ami']['errorType'] = type(error).__name__
finally:
    if ami: ami.close()

# Existing host exporter only. Never install, download, change a unit or expose a public port.
whitelist = re.compile(r'^(?:node_cpu_seconds_total|node_memory_MemTotal_bytes|node_memory_MemAvailable_bytes|node_load1|node_boot_time_seconds|node_filesystem_size_bytes|node_filesystem_avail_bytes|node_network_receive_bytes_total|node_network_transmit_bytes_total)(?:\{|\s)')
def metrics(url):
    request = urllib.request.Request(url, headers={'Accept':'text/plain','Accept-Encoding':'identity'})
    with urllib.request.urlopen(request, timeout=5) as response:
        raw = response.read(2*1024*1024+1)
        if len(raw)>2*1024*1024: raise RuntimeError('EXPORTER_BUDGET')
        text = raw.decode('utf-8', errors='replace')
        filtered = '\n'.join(line for line in text.splitlines() if whitelist.match(line))
        if not filtered: raise RuntimeError('NO_HOST_METRICS')
        if len(filtered.encode())>512*1024: raise RuntimeError('METRIC_BUDGET')
        return {'at':int(time.time()*1000),'metrics':filtered,'inputBytes':len(raw),'keptLines':len(filtered.splitlines())}
exporter_process, endpoint = None, 'http://127.0.0.1:9100/metrics'
report['exporter'] = {'source':'existing-loopback','samples':[],'binaryFound':False,'temporaryProcessStopped':None}
try:
    first = None
    try: first = metrics(endpoint)
    except Exception: pass
    if first is None:
        binary = next((value for value in [shutil.which('node_exporter'), shutil.which('prometheus-node-exporter'),
            '/usr/local/bin/node_exporter','/opt/node_exporter/node_exporter'] if value and os.path.isfile(value) and os.access(value,os.X_OK)), None)
        report['exporter']['binaryFound'] = bool(binary)
        if binary:
            probe = socket.socket(); probe.bind(('127.0.0.1',0)); ephemeral_port = probe.getsockname()[1]; probe.close()
            exporter_process = subprocess.Popen([binary,'--web.listen-address=127.0.0.1:'+str(ephemeral_port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            endpoint = 'http://127.0.0.1:'+str(ephemeral_port)+'/metrics'
            report['exporter']['source'] = 'ephemeral-existing-binary-actual-host-loopback'
            for attempt in range(10):
                time.sleep(0.3)
                try: first=metrics(endpoint); break
                except Exception: pass
        elif env_values.get('PBX_MONITORING_TARGETS'):
            try:
                targets=json.loads(env_values['PBX_MONITORING_TARGETS'])
                target=next((item for item in targets[:8] if item.get('role')=='asterisk'),None)
                if target and target.get('url','').startswith(('http://','https://')):
                    first=metrics(target['url']); endpoint=target['url']; report['exporter']['source']='existing-configured-target'
            except Exception: pass
    if first:
        report['exporter']['samples'].append(first)
        time.sleep(15)
        report['exporter']['samples'].append(metrics(endpoint))
        report['exporter']['available']=True
    else:
        report['exporter']['available']=False
        report['exporter']['pendingReason']='no_existing_exporter_endpoint_or_binary'
except Exception as error:
    report['exporter']['available']=False
    report['exporter']['errorType']=type(error).__name__
finally:
    if exporter_process:
        try:
            exporter_process.terminate(); exporter_process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            exporter_process.kill(); exporter_process.wait(timeout=4)
        report['exporter']['temporaryProcessStopped']=exporter_process.poll() is not None

# Capability probes only. No inference, user calls, external billable calls or SQL writes.
ari_apps = run(['asterisk','-rx','ari show apps'])
ari_module = run(['asterisk','-rx','module show like res_ari.so'])
ari_apps_count=None
if ari_apps:
    match=re.search(r'(\d+)\s+Stasis applications?',ari_apps,re.I)
    if match: ari_apps_count=int(match.group(1))
report['ai']={'deployedEnvFilesRead':len(env_files),
  'configuredKeyNames':sorted(key for key in env_values if re.match(r'^(?:ARI_|AI_|VOICE_|ROBOT_|OLLAMA_|OPENAI_|ANTHROPIC_|ELEVENLABS_|DEEPGRAM_|SA_|STT_|TTS_|LLM_)',key))[:80],
  'ariModuleLoaded':bool(ari_module and 'res_ari.so' in ari_module and 'Running' in ari_module),
  'ariApplicationsCount':ari_apps_count, 'inferenceOrCallsInvoked':False}
try:
    with urllib.request.urlopen('http://127.0.0.1:11434/api/tags', timeout=2) as response:
        data=json.loads(response.read(65536))
        report['ai']['ollamaAvailable']=True
        report['ai']['ollamaModelCount']=len(data.get('models',[]))
except Exception:
    report['ai']['ollamaAvailable']=False

meminfo={}
try:
    for line in open('/proc/meminfo'):
        key,value=line.split(':',1); meminfo[key]=int(value.strip().split()[0])*1024
except Exception: pass
capacity={'memoryTotalBytes':meminfo.get('MemTotal'),'memoryAvailableBytes':meminfo.get('MemAvailable'),'cpuCount':os.cpu_count()}
for label,directory in [('root','/'),('tmp','/tmp')]:
    stat=os.statvfs(directory); capacity[label+'AvailableBytes']=stat.f_bavail*stat.f_frsize
images=run(['docker','image','ls','--format','{{.Repository}}:{{.Tag}}']) or ''
capacity['cachedMysql8Images']=[line for line in images.splitlines() if re.search(r'(?:^|/)mysql:8(?:[.\-]|$)',line)][:10]
capacity['cachedPostgres17Images']=[line for line in images.splitlines() if re.search(r'(?:^|/)postgres:17(?:[.\-]|$)',line)][:10]
report['capacity']=capacity
report['mutations']={'config':False,'database':False,'calls':False,'installOrDownload':False,'publicPortOpened':False,
    'ephemeralExporterProcess':exporter_process is not None}
print(json.dumps(report, separators=(',',':')))
`;

const root = path.resolve(__dirname, '../..');
const key = 'C:\\Users\\Professional\\.ssh\\aipbx_ollama_audit';
const ssh = spawn('C:\\Windows\\System32\\OpenSSH\\ssh.exe', ['-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=8', 'root@ipbx.krasterisk.ru', 'python3', '-'], { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
let output='', errors='', bytes=0;
ssh.stdout.on('data',(chunk)=>{ bytes+=chunk.length;if(bytes>2*1024*1024){ssh.kill();return;}output+=chunk.toString();});
ssh.stderr.on('data',(chunk)=>{ errors+=chunk.toString(); if(errors.length>8192)errors=errors.slice(0,8192); });
ssh.stdin.end(remoteScript);
const deadline=setTimeout(()=>ssh.kill(),115000);
ssh.on('close',(code)=>{
  clearTimeout(deadline);
  const reportFile=path.join(__dirname,'live-source-report.json');
  const logFile=path.join(__dirname,'live-source.log');
  try {
    if(code!==0) throw new Error('ssh_failed_'+code);
    const report=JSON.parse(output.trim());
    report.checkedAt=new Date().toISOString();
    report.remoteHost='ipbx.krasterisk.ru';
    const source=fs.readFileSync(path.join(root,'packages/backend/src/modules/dashboard/dashboard-node-exporter.ts'),'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const exports={};new Function('exports','Buffer',compiled)(exports,Buffer);
    let previous;
    report.exporter.parserChecks=[];
    for(const sample of report.exporter.samples||[]){
      const parsed=exports.parseNodeExporter(sample.metrics,sample.at,undefined,previous);
      report.exporter.parserChecks.push({at:parsed.sample.at,inputBytes:sample.inputBytes,keptLines:sample.keptLines,
        cpuKnown:parsed.sample.cpu!==null,cpuPercent:parsed.sample.cpu,memoryPercent:parsed.sample.memory,
        loadPerCore:parsed.sample.load,uptimeSeconds:parsed.sample.uptime,networkRxKnown:parsed.sample.networkRx!==null,
        networkTxKnown:parsed.sample.networkTx!==null,disks:parsed.sample.disks.map(disk=>({usedPercent:disk.usedPercent,availableBytes:disk.availableBytes})),
        rootDiskKnown:parsed.sample.disks.some(disk=>disk.mount==='/'),missingFilesystemCount:parsed.sample.missingFilesystems?.length??0});
      previous=parsed;
    }
    delete report.exporter.samples;
    report.gates={amiBulkSource:report.ami.authenticated&&report.actions.length===4&&report.actions.every(action=>action.complete)?'pass':'pending',
      exporterActualSource:report.exporter.available&&report.exporter.parserChecks.length===2?'pass':'pending',
      newDashboardAppIntegration:'pending_not_deployed',humanIvRVoicemailTransferAiScenarios:'pending_isolated_test_context',
      liveTenThousandSubscribers:'pending_dedicated_load_stand'};
    fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
    const lines=[`Checked ${report.checkedAt}`,`Host ${report.remoteHost}`,`AMI authenticated=${report.ami.authenticated}`,
      ...report.actions.map(action=>`${action.action}: complete=${action.complete}, rows=${action.rows}, elapsedMs=${action.elapsedMs}, fields=${action.rowFields.join(',')}`),
      `Exporter available=${report.exporter.available}, source=${report.exporter.source}, parserSamples=${report.exporter.parserChecks.length}`,
      `AI capability-only: ARI loaded=${report.ai.ariModuleLoaded}, apps=${report.ai.ariApplicationsCount}, Ollama=${report.ai.ollamaAvailable}`,
      `Capacity ${JSON.stringify(report.capacity)}`,`Gates ${JSON.stringify(report.gates)}`,
      'No deployment/config/database/call changes. No credentials, caller IDs or endpoint values recorded.'];
    fs.writeFileSync(logFile,lines.join('\n')+'\n');
    process.stdout.write(lines.join('\n')+'\n');
  } catch(error){
    // Do not replay raw remote output or secret-bearing subprocess diagnostics.
    fs.writeFileSync(logFile,JSON.stringify({checkedAt:new Date().toISOString(),status:'failed',errorType:error.name,message:String(error.message).slice(0,100),sshExitCode:code,stderrPresent:!!errors})+'\n');
    process.stderr.write('Live source check failed; sanitized evidence saved.\n');process.exitCode=1;
  }
});
