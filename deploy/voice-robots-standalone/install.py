"""Bounded additive install. Existing config is parsed, never executed or printed."""
import argparse
import configparser
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess

TABLES = ['voice_robots', 'voice_robot_keyword_groups', 'voice_robot_keywords', 'voice_robot_logs',
          'voice_robot_cdr', 'voice_robot_data_lists', 'stt_engines', 'tts_engines']
ROOT = Path(__file__).resolve().parent
PROTECTED = ['/etc/asterisk/extensions.conf', '/etc/asterisk/http.conf', '/etc/asterisk/modules.conf',
             '/etc/asterisk/manager.conf', '/var/www/html/vpbx/index.php',
             '/etc/apache2/sites-enabled/000-default-le-ssl.conf']

def legacy_database():
    text = '\n'.join(Path(p).read_text() for p in ['/var/www/html/r_conf.php', '/var/www/html/vpbx/conf.php'])
    values = {}
    for m in re.finditer(r'''\$base\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(['"])(.*?)\2\s*;''', text, re.S):
        values[m[1]] = m[3]
    for block in re.finditer(r'''\$base\s*=\s*(?:array\s*\((.*?)\)|\[(.*?)\])\s*;''', text, re.S):
        for m in re.finditer(r'''(['"])([^'"]+)\1\s*=>\s*(['"])(.*?)\3''', block[1] or block[2], re.S):
            values[m[2]] = m[4]
    call = re.search(r'mysqli_connect\s*\((.*?)\)', text, re.S)
    keys = re.findall(r'''\$base\[['"]([^'"]+)['"]\]''', call[1])
    if len(keys) != 4 or any(k not in values for k in keys): raise RuntimeError('Unsupported legacy DB config')
    host, user, password, database = (values[k] for k in keys)
    return {'host': host, 'user': user, 'password': password, 'database': database}

def maintenance_database():
    # Debian's existing protected maintenance credential supports CREATE USER/GRANT.
    # The v3 account itself is limited to its database; never widen that account.
    legacy = legacy_database()
    defaults = configparser.ConfigParser(interpolation=None)
    defaults.read('/etc/mysql/debian.cnf')
    client = defaults['client']
    if not client.get('user') or not client.get('password'): raise RuntimeError('MySQL maintenance credential unavailable')
    return {'host': client.get('host', 'localhost'), 'user': client['user'],
            'password': client['password'], 'database': legacy['database']}

def identifier(value):
    if not re.fullmatch(r'[A-Za-z0-9_]+', value): raise RuntimeError('Invalid database identifier')
    return '`' + value + '`'

def mysql(config, sql, database=None, fail=True):
    env = os.environ.copy()
    env['MYSQL_PWD'] = config['password']
    command = ['mysql', '--connect-timeout=5', '--batch', '--skip-column-names',
               '--host=' + config['host'], '--user=' + config['user']]
    if database: command.append(database)
    result = subprocess.run(command, input='SET SESSION lock_wait_timeout=3; SET SESSION innodb_lock_wait_timeout=3;\n' + sql,
                            capture_output=True, text=True, env=env, timeout=60)
    if fail and result.returncode: raise RuntimeError('Database operation failed (credentials redacted)')
    return result

def tables(config, database):
    return mysql(config, 'SHOW TABLES;', database).stdout.splitlines()

def protected():
    return {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in PROTECTED}

def write_private(path, data, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, mode)
    with os.fdopen(fd, 'w') as f: json.dump(data, f, indent=2)

def validate_schema(config, database):
    schema = (ROOT / 'schema.sql').read_text()
    for table in TABLES:
        line = next(x for x in schema.splitlines() if x.startswith('CREATE TABLE IF NOT EXISTS `' + table + '`'))
        expected = set(re.findall(r'`([^`]+)`\s+(?:INTEGER|BIGINT|VARCHAR|TEXT|JSON|DATETIME|TINYINT|DECIMAL|FLOAT)', line))
        actual = {x.split('\t')[0] for x in mysql(config, 'SHOW COLUMNS FROM ' + identifier(table), database).stdout.splitlines()}
        if actual != expected: raise RuntimeError('Schema mismatch: ' + table)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['test', 'migrate', 'configure'])
    args = parser.parse_args()
    config = maintenance_database()
    schema = (ROOT / 'schema.sql').read_text()
    if args.mode == 'test':
        name = 'krsk_vr_test_' + secrets.token_hex(6)
        mysql(config, 'CREATE DATABASE ' + identifier(name) + ' CHARACTER SET utf8mb4;')
        try:
            mysql(config, schema, name); mysql(config, schema, name)
            validate_schema(config, name)
            foreign = mysql(config, "INSERT INTO voice_robot_keyword_groups(robot_id,name,user_uid) VALUES(99999,'invalid',42)", name, fail=False)
            if foreign.returncode == 0: raise RuntimeError('Foreign key enforcement failed')
            print(json.dumps({'migration_test': 'pass', 'idempotent': True, 'foreign_keys': True, 'table_count': len(tables(config, name))}))
        finally:
            # Exact freshly-created random schema owned by this invocation, never a supplied path/name.
            mysql(config, 'DROP DATABASE ' + identifier(name))
        return
    snapshot = ROOT / 'evidence'
    snapshot.mkdir(exist_ok=True)
    if args.mode == 'migrate':
        before = tables(config, config['database'])
        hashes = protected()
        write_private(snapshot / 'before.json', {'tables': before, 'hashes': hashes})
        # Metadata-only backup; no table or global read lock and no production records exported.
        ddl = {table: mysql(config, 'SHOW CREATE TABLE ' + identifier(table), config['database']).stdout for table in before}
        write_private(snapshot / 'legacy-schema.json', ddl)
        if set(before).intersection(TABLES): raise RuntimeError('Robot tables already exist; review before resuming')
        mysql(config, schema, config['database'])
        validate_schema(config, config['database'])
        after = tables(config, config['database'])
        if set(after) - set(before) != set(TABLES): raise RuntimeError('Unexpected table delta')
        if protected() != hashes: raise RuntimeError('Protected config changed externally during migration')
        write_private(snapshot / 'migration.json', {'added_tables': TABLES, 'sql_sha256': hashlib.sha256(schema.encode()).hexdigest(), 'protected_unchanged': True})
        print(json.dumps({'migration': 'pass', 'tables_before': len(before), 'tables_after': len(after), 'added': TABLES}))
        return
    # Configure only new module files and one least-privilege account in the existing DB.
    directory = Path('/etc/krasterisk-voice-robots')
    if directory.exists(): raise RuntimeError('Module secrets directory already exists; do not replace')
    password = secrets.token_urlsafe(36)
    api_key = secrets.token_urlsafe(36)
    account = "'krsk_voice_robots'@'localhost'"
    existing = mysql(config, "SELECT COUNT(*) FROM mysql.user WHERE User='krsk_voice_robots' AND Host='localhost';").stdout.strip()
    if existing != '0': raise RuntimeError('Runtime database account already exists')
    grants = [f'CREATE USER {account} IDENTIFIED BY \'{password}\';']
    for table in TABLES:
        grants.append(f'GRANT SELECT,INSERT,UPDATE,DELETE ON {identifier(config["database"])}.{identifier(table)} TO {account};')
    for table in ['contexts', 'queues', 'prompts']:
        grants.append(f'GRANT SELECT ON {identifier(config["database"])}.{identifier(table)} TO {account};')
    grants.append(f'GRANT SELECT (login,passwd,user_uid,level) ON {identifier(config["database"])}.users TO {account};')
    mysql(config, '\n'.join(grants))
    ari = configparser.ConfigParser(interpolation=None)
    ari.read('/etc/asterisk/ari.conf')
    if not ari.has_section('krasterisk') or ari['krasterisk'].get('read_only', 'no').strip() == 'yes': raise RuntimeError('Writable krasterisk ARI user required')
    ari_password = ari['krasterisk'].get('password', '').strip()
    if not ari_password or ari['krasterisk'].get('password_format', 'plain').strip() != 'plain': raise RuntimeError('Plain ARI credential required')
    import pwd
    runtime = pwd.getpwnam('krsk-voice-robots')
    directory.mkdir(mode=0o750)
    backend = {'NODE_ENV': 'production', 'BACKEND_PORT': '5013', 'DB_DIALECT': 'mysql', 'DB_HOST': '127.0.0.1',
               'DB_USER': 'krsk_voice_robots', 'DB_PASSWORD': password, 'DB_NAME': config['database'], 'DB_POOL_MAX': '3',
               'ARI_HOST': '127.0.0.1', 'ARI_PORT': '8088', 'ARI_HTTP_PREFIX': 'asterisk', 'ARI_USER': 'krasterisk',
               'ARI_PASSWORD': ari_password, 'ARI_APP_NAME': 'mpbx_voice_robots', 'ARI_SCRIPTED_ONLY': 'true',
               'VOICE_ROBOTS_PUBLIC_API_KEY': api_key, 'CC_AI_KEY_SECRET': secrets.token_urlsafe(48),
               'VOICE_ROBOTS_REQUIRE_TENANT': 'true', 'VOICE_ROBOTS_MAX_SESSIONS': '3', 'VOICE_ROBOTS_SEMANTIC_ENABLED': 'false',
               'EXTERNAL_RTP_HOST': '127.0.0.1', 'ASTERISK_CONFIG_DIR': '/etc/asterisk', 'OMP_NUM_THREADS': '1',
               'RUNTIME_UID': runtime.pw_uid, 'RUNTIME_GID': runtime.pw_gid}
    write_private(directory / 'backend.json', backend)
    bridge = {'db_host': '127.0.0.1', 'db_user': 'krsk_voice_robots', 'db_password': password,
              'db_name': config['database'], 'backend_port': 5013, 'api_key': api_key}
    write_private(directory / 'bridge.json', bridge, 0o640)
    import grp
    gid = grp.getgrnam('www-data').gr_gid
    os.chown(directory, 0, gid); os.chown(directory / 'bridge.json', 0, gid)
    print(json.dumps({'configuration': 'pass', 'database_account': 'krsk_voice_robots', 'port': 5013, 'ari_app': 'mpbx_voice_robots'}))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'error': str(error)}))
        raise SystemExit(1)
