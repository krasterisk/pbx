'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {loadMigrations}=require('../migration-runner.cjs');
test('dashboard migration is full PBX only and portable indexed additive read model',()=>{
 for(const dialect of ['mysql','postgres']){
  const list=loadMigrations(dialect,'full-pbx');assert.ok(list.some(m=>m.id==='0033-pbx-dashboard.sql'));
  const text=fs.readFileSync(path.join(__dirname,'../migrations',dialect==='postgres'?'postgres/0033-pbx-dashboard.sql':'0033-pbx-dashboard.sql'),'utf8');
  for(const table of ['dashboard_calls','dashboard_participants','dashboard_buckets','dashboard_checkpoints','dashboard_leases','dashboard_live_state','dashboard_system_samples']) assert.match(text,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
  assert.match(text,/tenant, started_at, call_key/);assert.match(text,/tenant, kind, value, call_key/);assert.match(text,/cursor_key VARCHAR\(128\)/);
  assert.doesNotMatch(text,/DROP TABLE|TRUNCATE TABLE|UPDATE cdr/i);
  for(const profile of ['analytics-api','robot-api']) {
    assert.ok(!loadMigrations(dialect,profile).some(m=>m.id==='0033-pbx-dashboard.sql'));
  }
 }
});

test('legacy CEL repair is an additive full-PBX migration after dashboard on both engines',()=>{
 for(const dialect of ['mysql','postgres']){
  const list=loadMigrations(dialect,'full-pbx');
  const dashboardIndex=list.findIndex(m=>m.id==='0033-pbx-dashboard.sql');
  assert.ok(dashboardIndex>=0);
  const repair=list[dashboardIndex+1];assert.equal(repair.id,'0034-cel-extra.sql');
  assert.match(repair.sql,/ALTER TABLE cel ADD COLUMN (?:IF NOT EXISTS )?extra VARCHAR\(512\) NULL/);
  assert.doesNotMatch(repair.sql,/DROP\s|TRUNCATE\s|UPDATE\s|DELETE\s/i);
  if(dialect==='mysql') assert.match(repair.sql,/table_schema = DATABASE\(\) AND table_name = 'cel' AND column_name = 'extra'/);
  for(const profile of ['analytics-api','robot-api']) assert.ok(!loadMigrations(dialect,profile).some(m=>m.id===repair.id));
 }
});
