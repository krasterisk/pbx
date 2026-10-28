"""Generate configs for the owned A13 fixture only; does not start or call a PBX."""
import argparse
import json
import os
import re
import secrets
from pathlib import Path


def prepare(receipt_path, directory, peer_ip):
    receipt = json.loads(receipt_path.read_text())
    tenant = receipt['tenant']
    if not isinstance(tenant, int) or tenant <= 0 or len(receipt['agents']) != 200:
        raise ValueError('Expected owned A13 cabinet with 200 operators')
    if not re.fullmatch(r'172\.20\.\d{1,3}\.\d{1,3}', peer_ip):
        raise ValueError('SIP peer must be on the private test-stand network')
    if directory.exists():
        raise ValueError('Refusing to overwrite existing Asterisk configuration')
    directory.mkdir(mode=0o700)
    secret = secrets.token_urlsafe(32)
    configs = {
        'asterisk.conf': '[directories]\nastetcdir => /etc/asterisk\nastmoddir => /usr/lib/asterisk/modules\nastvarlibdir => /var/lib/asterisk\nastdbdir => /var/lib/asterisk\nastkeydir => /var/lib/asterisk\nastdatadir => /var/lib/asterisk\nastagidir => /usr/share/asterisk/agi-bin\nastspooldir => /var/spool/asterisk\nastrundir => /var/run/asterisk\nastlogdir => /var/log/asterisk\n[options]\nverbose=0\ndebug=0\nmaxcalls=650\n',
        'modules.conf': '[modules]\nautoload=yes\nnoload=chan_sip.so\nnoload=res_config_odbc.so\nnoload=res_odbc.so\nnoload=cdr_odbc.so\nnoload=cdr_adaptive_odbc.so\nnoload=cel_odbc.so\n',
        'manager.conf': f'[general]\nenabled=yes\nport=5038\nbindaddr=0.0.0.0\ntimestampevents=yes\ndisplayconnects=no\n[krasterisk]\nsecret={secret}\ndeny=0.0.0.0/0.0.0.0\npermit=172.20.0.0/255.255.0.0\nread=all\nwrite=all\n',
        'rtp.conf': '[general]\nrtpstart=10000\nrtpend=14000\nstrictrtp=yes\n',
        'logger.conf': '[general]\n[logfiles]\nconsole => warning,error\n',
        'musiconhold.conf': '[default]\nmode=files\ndirectory=/var/lib/asterisk/sounds/bench\n',
        'extensions.conf': '[general]\nstatic=yes\nwriteprotect=yes\n[bench-source]\nexten => _q.,1,Answer()\n same => n,Queue(${EXTEN})\n same => n,Hangup()\n[bench-media]\nexten => s,1,Answer()\n same => n,Playback(bench/silence,noanswer)\n same => n,Goto(s,2)\n[bench-reject]\nexten => _.,1,Hangup()\n',
    }
    queues = '[general]\npersistentmembers=no\nautofill=yes\n'
    for queue in receipt['queues']:
        if not re.fullmatch(r'q86\d{2}_' + str(tenant), queue):
            raise ValueError('Unowned queue in receipt')
        queues += f'[{queue}]\nstrategy=rrmemory\ntimeout=20\nretry=1\nwrapuptime=0\nringinuse=no\njoinempty=yes\nleavewhenempty=no\nservicelevel=20\nsetinterfacevar=yes\n'
    configs['queues.conf'] = queues
    pjsip = '[global]\ntype=global\n[transport-udp]\ntype=transport\nprotocol=udp\nbind=0.0.0.0:5060\n'
    for agent in receipt['agents']:
        endpoint = agent['endpoint']
        if not re.fullmatch(r'e8[78]\d{2}_' + str(tenant), endpoint):
            raise ValueError('Unowned endpoint in receipt')
        pjsip += f'[{endpoint}]\ntype=endpoint\ntransport=transport-udp\ncontext=bench-reject\ndisallow=all\nallow=ulaw\naors={endpoint}\ndirect_media=no\nrtp_symmetric=yes\nforce_rport=yes\n[{endpoint}]\ntype=aor\ncontact=sip:{endpoint}@{peer_ip}:5070\nqualify_frequency=30\n'
    configs['pjsip.conf'] = pjsip
    for name, value in configs.items():
        target = directory / name
        target.write_text(value)
        target.chmod(0o600)
    private = directory.parent / 'asterisk-private.json'
    private.write_text(json.dumps({'amiHost': 'krasterisk-a13-asterisk', 'amiPort': 5038,
                                   'amiUsername': 'krasterisk', 'amiSecret': secret,
                                   'tenant': tenant, 'peerIp': peer_ip}))
    private.chmod(0o600)
    sounds = directory.parent / 'sounds'
    sounds.mkdir(mode=0o700)
    (sounds / 'silence.ulaw').write_bytes(b'\xff' * 160000)
    print(json.dumps({'tenant': tenant, 'endpoints': 200, 'queues': 12,
                      'config': str(directory), 'publicPorts': 0, 'externalDialplan': False}))


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('--receipt', type=Path, required=True)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--peer-ip', required=True)
    args = parser.parse_args()
    prepare(args.receipt, args.directory, args.peer_ip)
