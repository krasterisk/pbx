const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const remoteScript = String.raw`
import os, sys, re, json, time, uuid, socket, hashlib, urllib.request, subprocess, tarfile, shutil, signal
version='1.10.2'
asset='node_exporter-'+version+'.linux-amd64.tar.gz'
base='https://github.com/prometheus/node_exporter/releases/download/v'+version+'/'
expected_dir='/tmp/pbx-dashboard-exporter-'+str(uuid.uuid4())
tempdir=None
process=None
binary=None
report={'version':version,'source':'official-temporary-binary-actual-linux-host','host':'ipbx.krasterisk.ru',
 'officialRelease':'https://github.com/prometheus/node_exporter/releases/tag/v'+version,
 'tarballUrl':base+asset,'checksumUrl':base+'sha256sums.txt','samples':[],
 'configChanged':False,'serviceInstalled':False,'databaseChanged':False,'callsInvoked':False,'publicPortOpened':False,
 'cleanup':{'ownProcessStopped':False,'tempdirRemoved':False,'containmentVerified':False},'collectors':['cpu','meminfo','filesystem','loadavg','time','netdev','stat']}

def verify_directory():
    return tempdir==expected_dir and os.path.dirname(tempdir)=='/tmp' and os.path.realpath(tempdir)==expected_dir and not os.path.islink(tempdir)
def verify_process():
    if not process or process.poll() is not None: return True
    try:
        executable=os.path.realpath('/proc/'+str(process.pid)+'/exe')
        return executable==binary and os.path.commonpath([executable,expected_dir])==expected_dir
    except Exception: return False

def cleanup():
    if process:
        if process.poll() is None and verify_process():
            process.terminate()
            try: process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                if verify_process(): process.kill(); process.wait(timeout=3)
        report['cleanup']['ownProcessStopped']=process.poll() is not None
    else: report['cleanup']['ownProcessStopped']=True
    if tempdir and os.path.exists(tempdir):
        report['cleanup']['containmentVerified']=verify_directory()
        if report['cleanup']['containmentVerified'] and report['cleanup']['ownProcessStopped']:
            shutil.rmtree(tempdir)
            report['cleanup']['tempdirRemoved']=not os.path.exists(tempdir)
    elif tempdir: report['cleanup']['tempdirRemoved']=True

def interrupted(signum, frame):
    raise RuntimeError('INTERRUPTED')
for signum in [signal.SIGTERM,signal.SIGINT,signal.SIGHUP]: signal.signal(signum,interrupted)

def read_bounded(url, max_bytes, save=None):
    start=time.monotonic()
    request=urllib.request.Request(url,headers={'User-Agent':'Krasterisk-dashboard-isolated-live-check','Accept-Encoding':'identity'})
    digest=hashlib.sha256(); chunks=[]; count=0
    with urllib.request.urlopen(request,timeout=10) as response:
        output=open(save,'xb') if save else None
        try:
            while True:
                if time.monotonic()-start>40: raise RuntimeError('DOWNLOAD_DEADLINE')
                chunk=response.read(65536)
                if not chunk: break
                count+=len(chunk)
                if count>max_bytes: raise RuntimeError('DOWNLOAD_BUDGET')
                digest.update(chunk)
                if output: output.write(chunk)
                else: chunks.append(chunk)
        finally:
            if output: output.close()
    return {'bytes':count,'sha256':digest.hexdigest(),'body':b''.join(chunks).decode() if not save else None}

whitelist=re.compile(r'^(?:node_cpu_seconds_total|node_memory_MemTotal_bytes|node_memory_MemAvailable_bytes|node_load1|node_boot_time_seconds|node_filesystem_size_bytes|node_filesystem_avail_bytes|node_network_receive_bytes_total|node_network_transmit_bytes_total)(?:\{|\s)')
def sample(url):
    start=time.monotonic()
    with urllib.request.urlopen(urllib.request.Request(url,headers={'Accept-Encoding':'identity'}),timeout=5) as response:
        body=response.read(2*1024*1024+1)
        if len(body)>2*1024*1024: raise RuntimeError('SCRAPE_BUDGET')
    text=body.decode('utf-8')
    selected='\n'.join(line for line in text.splitlines() if whitelist.match(line))
    if len(selected.encode())>512*1024: raise RuntimeError('FILTERED_METRIC_BUDGET')
    names=sorted(set(line.split('{',1)[0].split(' ',1)[0] for line in selected.splitlines()))
    success={}
    for match in re.finditer(r'^node_scrape_collector_success\{collector="([^"]+)"\}\s+([0-9.]+)$',text,re.M): success[match.group(1)]=float(match.group(2))==1
    build=re.search(r'^node_exporter_build_info\{[^\n]*version="'+re.escape(version)+'"[^\n]*\}\s+1$',text,re.M)
    return {'at':int(time.time()*1000),'metrics':selected,'metricNames':names,'inputBytes':len(body),'keptLines':len(selected.splitlines()),
      'scrapeMs':round((time.monotonic()-start)*1000,1),'collectorSuccess':success,'pinnedBuildInfo':bool(build)}

try:
    if os.uname().machine!='x86_64': raise RuntimeError('HOST_ARCHITECTURE_NOT_AMD64')
    os.mkdir(expected_dir,0o700);tempdir=expected_dir
    if not verify_directory(): raise RuntimeError('TEMP_CONTAINMENT')
    manifest=read_bounded(base+'sha256sums.txt',256*1024)
    matching=[]
    for line in manifest['body'].splitlines():
        parts=line.split()
        if len(parts)==2 and parts[1].lstrip('*')==asset and re.fullmatch(r'[a-fA-F0-9]{64}',parts[0]): matching.append(parts[0].lower())
    if len(matching)!=1: raise RuntimeError('OFFICIAL_SHA_ENTRY_MISSING')
    archive=os.path.join(tempdir,asset)
    download=read_bounded(base+asset,20*1024*1024,archive)
    if download['sha256']!=matching[0]: raise RuntimeError('SHA256_MISMATCH')
    report['downloadBytes']=download['bytes']; report['verifiedSha256']=download['sha256'];report['checksumVerified']=True
    binary=os.path.join(tempdir,'node_exporter')
    with tarfile.open(archive,'r:gz') as tar:
        member=tar.getmember('node_exporter-'+version+'.linux-amd64/node_exporter')
        if not member.isfile() or member.size>64*1024*1024: raise RuntimeError('UNSAFE_ARCHIVE_BINARY')
        source=tar.extractfile(member)
        with open(binary,'xb') as output:
            shutil.copyfileobj(source,output,65536)
    os.chmod(binary,0o700)
    if os.path.realpath(binary)!=binary or os.path.commonpath([binary,tempdir])!=tempdir: raise RuntimeError('BINARY_CONTAINMENT')
    version_check=subprocess.run([binary,'--version'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5,text=True)
    if 'version '+version not in (version_check.stdout+version_check.stderr): raise RuntimeError('BINARY_VERSION_MISMATCH')
    probe=socket.socket();probe.bind(('127.0.0.1',0));port=probe.getsockname()[1];probe.close()
    if port<1024: raise RuntimeError('UNSAFE_PORT')
    args=[binary,'--web.listen-address=127.0.0.1:'+str(port),'--collector.disable-defaults']+['--collector.'+name for name in report['collectors']]
    environment=dict(os.environ);environment['GOMAXPROCS']='1';environment['GOMEMLIMIT']='64MiB'
    process=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=environment,preexec_fn=lambda:os.nice(10))
    if not verify_process(): raise RuntimeError('PID_EXECUTABLE_CONTAINMENT')
    report['listenAddress']='127.0.0.1';report['listenPort']=port;report['temporaryPid']=process.pid
    endpoint='http://127.0.0.1:'+str(port)+'/metrics'
    first=None
    for attempt in range(12):
        if process.poll() is not None: raise RuntimeError('EXPORTER_EXITED')
        time.sleep(0.25)
        try: first=sample(endpoint);break
        except Exception: pass
    if first is None: raise RuntimeError('EXPORTER_NOT_READY')
    report['samples'].append(first)
    time.sleep(15.1)
    report['samples'].append(sample(endpoint))
    report['intervalMs']=report['samples'][1]['at']-report['samples'][0]['at']
    report['sourceVerified']=all(item['pinnedBuildInfo'] and all(item['collectorSuccess'].get(name)==True for name in report['collectors']) for item in report['samples'])
except Exception as error:
    report['errorType']=type(error).__name__
    report['errorCode']=str(error) if str(error) in ['INTERRUPTED','DOWNLOAD_DEADLINE','DOWNLOAD_BUDGET','SCRAPE_BUDGET','FILTERED_METRIC_BUDGET','HOST_ARCHITECTURE_NOT_AMD64','TEMP_CONTAINMENT','OFFICIAL_SHA_ENTRY_MISSING','SHA256_MISMATCH','UNSAFE_ARCHIVE_BINARY','BINARY_CONTAINMENT','BINARY_VERSION_MISMATCH','UNSAFE_PORT','PID_EXECUTABLE_CONTAINMENT','EXPORTER_EXITED','EXPORTER_NOT_READY'] else 'SOURCE_CHECK_FAILED'
finally:
    cleanup()
print(json.dumps(report,separators=(',',':')))
`;
const root = path.resolve(__dirname, '../..');
const key = 'C:/Users/Professional/.ssh/aipbx_ollama_audit';
const executable = 'C:/Windows/System32/OpenSSH/ssh.exe';
const ssh = spawn(executable,['-i',key,'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8','root@ipbx.krasterisk.ru','python3','-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
let output='', diagnosticPresent=false, bytes=0;
ssh.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){ssh.kill();return;}output+=chunk.toString();});
ssh.stderr.on('data',()=>{diagnosticPresent=true;});
ssh.stdin.end(remoteScript);
const deadline=setTimeout(()=>ssh.kill(),120000);
ssh.on('close',async code=>{
  clearTimeout(deadline);
  const reportFile=path.join(__dirname,'live-exporter-report.json');
  const logFile=path.join(__dirname,'live-exporter.log');
  try {
    if(code!==0)throw new Error('SSH_FAILED');
    const report=JSON.parse(output.trim());report.checkedAt=new Date().toISOString();
    require('ts-node').register({transpileOnly:true,project:path.join(root,'packages/backend/tsconfig.json'),compilerOptions:{module:'CommonJS'}});
    const {parseNodeExporter}=require(path.join(root,'packages/backend/src/modules/dashboard/dashboard-node-exporter.ts'));
    const {DashboardSystemService}=require(path.join(root,'packages/backend/src/modules/dashboard/dashboard-system.service.ts'));
    let previous; report.parserChecks=[];
    for(const sample of report.samples){
      const parsed=parseNodeExporter(sample.metrics,sample.at,undefined,previous);
      report.parserChecks.push({at:parsed.sample.at,metricNames:sample.metricNames,inputBytes:sample.inputBytes,keptLines:sample.keptLines,
        collectorSuccess:sample.collectorSuccess,pinnedBuildInfo:sample.pinnedBuildInfo,cpuPercent:parsed.sample.cpu,memoryPercent:parsed.sample.memory,
        loadPerCore:parsed.sample.load,uptimeSeconds:parsed.sample.uptime,networkRxBytesPerSecond:parsed.sample.networkRx,networkTxBytesPerSecond:parsed.sample.networkTx,
        disks:parsed.sample.disks,missingFilesystems:parsed.sample.missingFilesystems});
      previous=parsed;
    }
    // Real application service + actual host metrics, isolated local in-memory SQL/lease adapters.
    // This validates provider parsing/state/payload behavior, not live persistence or deployment.
    const payloads=[];const sqlKinds=[];
    const sequelize={query:async(sql,options)=>{sqlKinds.push(sql.split(' ')[0]);if(sql.startsWith('INSERT INTO'))payloads.push(JSON.parse(options.replacements.payload));return[];},getDialect:()=> 'postgres'};
    const target={id:'live-host',label:'Actual Linux host',role:'asterisk',url:'http://127.0.0.1:65534/metrics',filesystems:['/']};
    const config={get:(key,fallback)=>key==='DEPLOYMENT_MODE'?'BOX':key==='PBX_MONITORING_TARGETS'?JSON.stringify([target]):fallback};
    const store={acquireLease:async()=>true,renewLease:async()=>true,releaseLease:async()=>{}};
    const service=new DashboardSystemService(sequelize,config,store);let current;
    service.fetchExporter=async()=>current.metrics;
    const originalNow=Date.now;
    try {
      for(const sample of report.samples){current=sample;Date.now=()=>sample.at;await service.collect();}
      const nodes=await service.getOverview();
      report.serviceHarness={kind:'actual-service-local-memory-adapters-actual-host-samples',persistedSamples:payloads.length,sqlKinds,
        source:nodes[0]?.source,current:nodes[0]?.current,warnings:service.getWarnings(),boundedDisks:(nodes[0]?.current?.disks.length??0)<=8};
    } finally {Date.now=originalNow;}
    delete report.samples;
    const second=report.parserChecks[1];
    report.gates={actualHostExporter:report.sourceVerified&&report.intervalMs>=15000&&second?.cpuPercent!==null&&second?.memoryPercent!==null&&second?.loadPerCore!==null&&second?.uptimeSeconds!==null&&second?.networkRxBytesPerSecond!==null&&second?.disks.some(disk=>disk.mount==='/')?'pass':'pending',
      providerLocalHarness:report.serviceHarness.persistedSamples===2&&report.serviceHarness.source?.state==='ok'?'pass':'pending',
      cleanup:report.cleanup.ownProcessStopped&&report.cleanup.tempdirRemoved&&report.cleanup.containmentVerified?'pass':'pending',
      remotePersistedService:'pending_new_code_not_deployed',liveCallFlows:'pending_isolated_call_test_context'};
    fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
    const lines=[`Checked ${report.checkedAt}`,`Official exporter ${report.version}: sha256 verified=${report.checksumVerified}, downloadBytes=${report.downloadBytes}`,
      `Actual source ${report.source}; loopback=${report.listenAddress}; intervalMs=${report.intervalMs}`,
      ...report.parserChecks.map((sample,index)=>`Sample${index+1}: CPU=${sample.cpuPercent}, RAM=${sample.memoryPercent}, loadPerCore=${sample.loadPerCore}, uptime=${sample.uptimeSeconds}, RX=${sample.networkRxBytesPerSecond}, TX=${sample.networkTxBytesPerSecond}, disks=${sample.disks.length}`),
      `Provider local actual-service harness ${JSON.stringify(report.serviceHarness.source)}, persistedSamples=${report.serviceHarness.persistedSamples}`,
      `Cleanup ${JSON.stringify(report.cleanup)}`,`Gates ${JSON.stringify(report.gates)}`,
      'No production config/service/database/call changes; no public listener; remote executable/tempdir removed.'];
    fs.writeFileSync(logFile,lines.join('\n')+'\n');process.stdout.write(lines.join('\n')+'\n');
    if(Object.values(report.gates).slice(0,3).some(state=>state!=='pass'))process.exitCode=1;
  } catch(error){
    fs.writeFileSync(logFile,JSON.stringify({checkedAt:new Date().toISOString(),status:'failed',errorType:error.name,errorCode:String(error.message).slice(0,100),sshExitCode:code,diagnosticPresent})+'\n');
    process.stderr.write('Temporary live exporter check failed; sanitized evidence saved.\n');process.exitCode=1;
  }
});
