'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {loadMigrations}=require('../migration-runner.cjs');
test('cc-analytics 0036 is an additive full-PBX migration on both engines',()=>{
 for(const dialect of ['mysql','postgres']){
  const list=loadMigrations(dialect,'full-pbx');
  const migration=list.find(m=>m.id==='0036-callcenter-metrics-truth.sql');
  assert.ok(migration,dialect+' manifest lists 0036');
  assert.ok(list.indexOf(migration)>=0);
  const text=fs.readFileSync(path.join(__dirname,'../migrations',dialect==='postgres'?'postgres/0036-callcenter-metrics-truth.sql':'0036-callcenter-metrics-truth.sql'),'utf8');
  assert.match(text,/CREATE TABLE IF NOT EXISTS cc_agent_offers/);
  assert.match(text,/idx_cc_agent_offers_tenant_time ON cc_agent_offers \(vpbx_user_uid, offered_at\)/);
  for(const column of ['transferred_calls','short_abandoned_calls','sla_threshold_sec','total_wait_sec','total_hold_sec','total_wrapup_sec','rollup_version']) assert.match(text,new RegExp('ALTER TABLE cc_daily_queue_stats ADD COLUMN '+column+' INTEGER NOT NULL DEFAULT'));
  assert.match(text,/ALTER TABLE cc_settings ADD COLUMN short_abandon_sec INTEGER NOT NULL DEFAULT 5/);
  assert.doesNotMatch(text,/DROP\s|TRUNCATE\s|DELETE\s|UPDATE\s/i);
  for(const profile of ['analytics-api','robot-api']) assert.ok(!loadMigrations(dialect,profile).some(m=>m.id===migration.id));
 }
});
