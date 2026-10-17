'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {loadMigrations}=require('../migration-runner.cjs');
test('cc-ux 0039 adds the nullable agent_hotkeys column, additively, full-PBX only',()=>{
 for(const dialect of ['mysql','postgres']){
  const list=loadMigrations(dialect,'full-pbx');
  const migration=list.find(m=>m.id==='0039-callcenter-agent-hotkeys.sql');
  assert.ok(migration,dialect+' manifest lists 0039');
  assert.ok(list.includes(migration));
  assert.ok(list.findIndex(m=>m.id==='0038-callcenter-dashboard-page.sql')<list.indexOf(migration));
  const text=fs.readFileSync(path.join(__dirname,'../migrations',dialect==='postgres'?'postgres/0039-callcenter-agent-hotkeys.sql':'0039-callcenter-agent-hotkeys.sql'),'utf8');
  assert.ok(!text.includes('\r'),'LF only: checksums must match on every OS');
  assert.match(text,dialect==='postgres'?/ALTER TABLE cc_settings ADD COLUMN agent_hotkeys JSONB NULL;/:/ALTER TABLE cc_settings ADD COLUMN agent_hotkeys JSON NULL;/);
  assert.doesNotMatch(text,/DROP\s|TRUNCATE\s|DELETE\s|UPDATE\s/i);
  for(const profile of ['analytics-api','robot-api']) assert.ok(!loadMigrations(dialect,profile).some(m=>m.id===migration.id));
 }
});
