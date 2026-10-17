'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {loadMigrations}=require('../migration-runner.cjs');
test('cc-analytics 0038 registers the dashboard hub page, additively and idempotently, full-PBX only',()=>{
 for(const dialect of ['mysql','postgres']){
  const list=loadMigrations(dialect,'full-pbx');
  const migration=list.find(m=>m.id==='0038-callcenter-dashboard-page.sql');
  assert.ok(migration,dialect+' manifest lists 0038');
  assert.ok(list.some(m=>m.id===migration.id));
  assert.ok(list.findIndex(m=>m.id==='0037-callcenter-interval-stats.sql')<list.indexOf(migration));
  const text=fs.readFileSync(path.join(__dirname,'../migrations',dialect==='postgres'?'postgres/0038-callcenter-dashboard-page.sql':'0038-callcenter-dashboard-page.sql'),'utf8');
  assert.ok(!text.includes('\r'),'LF only: checksums must match on every OS');
  assert.match(text,/'callcenter', 'cc_dashboard', '\/callcenter\/dashboard', 10/);
  assert.match(text,dialect==='postgres'?/ON CONFLICT \(hub_code, page_code\) DO NOTHING/:/INSERT IGNORE INTO hub_module_pages/);
  assert.doesNotMatch(text,/DROP\s|TRUNCATE\s|DELETE\s|UPDATE\s|ALTER\s/i);
  for(const profile of ['analytics-api','robot-api']) assert.ok(!loadMigrations(dialect,profile).some(m=>m.id===migration.id));
 }
});
