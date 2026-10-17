'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {loadMigrations}=require('../migration-runner.cjs');
test('cc-analytics 0037 adds the interval table as an additive full-PBX migration on both engines',()=>{
 for(const dialect of ['mysql','postgres']){
  const list=loadMigrations(dialect,'full-pbx');
  const migration=list.find(m=>m.id==='0037-callcenter-interval-stats.sql');
  assert.ok(migration,dialect+' manifest lists 0037');
  assert.ok(list.indexOf(migration)>=0);
  assert.ok(list.findIndex(m=>m.id==='0036-callcenter-metrics-truth.sql')<list.indexOf(migration));
  const text=fs.readFileSync(path.join(__dirname,'../migrations',dialect==='postgres'?'postgres/0037-callcenter-interval-stats.sql':'0037-callcenter-interval-stats.sql'),'utf8');
  assert.ok(!text.includes('\r'),'LF only: checksums must match on every OS');
  assert.match(text,/CREATE TABLE IF NOT EXISTS cc_interval_queue_stats/);
  assert.match(text,/CREATE UNIQUE INDEX uq_cc_interval_queue_tenant_start_queue ON cc_interval_queue_stats \(vpbx_user_uid, interval_start, queue_name\)/);
  for(const column of ['total_calls','answered_calls','abandoned_calls','short_abandoned_calls','transferred_calls','sla_met_calls','sla_threshold_sec','total_wait_sec','total_talk_sec','total_hold_sec','total_wrapup_sec','max_wait_sec']) assert.match(text,new RegExp(column+' INTEGER NOT NULL DEFAULT'));
  assert.doesNotMatch(text,/DROP\s|TRUNCATE\s|DELETE\s|UPDATE\s|ALTER\s/i);
  for(const profile of ['analytics-api','robot-api']) assert.ok(!loadMigrations(dialect,profile).some(m=>m.id===migration.id));
 }
});
