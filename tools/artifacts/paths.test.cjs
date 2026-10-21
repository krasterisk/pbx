'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const api=require('./paths.cjs');
const prior=process.env.ARTIFACTS_ROOT;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'krasterisk-artifact-test-'));
after(()=>{if(prior===undefined)delete process.env.ARTIFACTS_ROOT;else process.env.ARTIFACTS_ROOT=prior;const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(resolved,{recursive:true,force:true});});
test('default root and absolute override stay outside the checkout',()=>{
 delete process.env.ARTIFACTS_ROOT;assert.equal(api.artifactsRoot(),path.join(os.homedir(),'Documents','DevArtifacts','krasterisk_v4'));
 process.env.ARTIFACTS_ROOT=temp;assert.equal(api.artifactsRoot(),temp);
});
test('rejects relative, nested, ancestor and junction-alias roots',()=>{
 for(const value of ['relative',api.repository,path.join(api.repository,'.tmp'),path.dirname(api.repository)]){
  process.env.ARTIFACTS_ROOT=value;assert.throws(()=>api.artifactsRoot());
 }
 const link=path.join(temp,'checkout');fs.symlinkSync(api.repository,link,'junction');process.env.ARTIFACTS_ROOT=path.join(link,'inside');assert.throws(()=>api.artifactsRoot());
 process.env.ARTIFACTS_ROOT=temp;
});
test('new builds, cache, screenshots and generated results resolve externally',()=>{
 for(const rel of ['.planning/autodial-ux-audit/backend-dist-99/main.js','.planning/autodial-ux-audit/sapi-cache/a.wav','.planning/cc-ux/new-screen.png','.planning/autodial-ux-audit/live-new-result.json','harness/reports/new.xml']){
  assert.equal(api.artifactPath(path.join(api.repository,rel)),path.join(temp,'legacy',rel));
 }
});
test('documents, scripts, fixtures, tracked evidence, active CDR and remote paths are preserved',()=>{
 for(const rel of ['.planning/autodial-ux-audit/PLAN.md','.planning/autodial-ux-audit/probe.cjs','.planning/autodial-ux-audit/ui-fixture.json','.planning/autodial-ux-audit/BASELINE.json','.planning/cdr-reports-ux/screen.png','packages/backend/src/main.ts']){
  const original=path.join(api.repository,rel);assert.equal(api.artifactPath(original),original);
 }
 for(const original of ['/opt/krasterisk-labs/example/report.json',42,Buffer.from('fd')])assert.equal(api.artifactPath(original),original);
 const policy=require('./policy.json');for(const rel of policy.preserve)assert.equal(api.isArtifact(rel),false);
});
test('write option creates external parents and reads the same migrated file',()=>{
 const original=path.join(api.repository,'.planning/autodial-ux-audit/nested/new-result.json');
 const output=api.artifactPath(original,{write:true});fs.writeFileSync(output,'{"ok":true}');
 assert.equal(fs.readFileSync(api.artifactPath(original),'utf8'),'{"ok":true}');assert.equal(fs.existsSync(original),false);
});
test('output segments cannot escape the selected external root',()=>{
 for(const parts of [['..'],['x/../y'],['x\\..\\y'],[path.resolve('/absolute')]])assert.throws(()=>api.outputPath(...parts));
 assert.equal(api.outputPath('runs','audit','001'),path.join(temp,'runs','audit','001'));
});
test('Python and Node classify the same paths and share external writes',(t)=>{
 const python=process.env.ARTIFACTS_PYTHON;if(!python){t.skip('Set ARTIFACTS_PYTHON for cross-language checks');return;}
 const cases=['.planning/autodial-ux-audit/live-new-result.json','.planning/autodial-ux-audit/PLAN.md','.planning/cc-ux/screen.png','.planning/cdr-reports-ux/screen.png','harness/reports/new.xml'];
 const script="import json,sys;sys.path.insert(0,sys.argv[1]);from tools.artifacts.paths import artifact_path,artifacts_root;from pathlib import Path;cases=json.loads(sys.argv[2]);print(json.dumps([str(artifact_path(Path(sys.argv[1])/p)) for p in cases]));p=artifact_path(Path(sys.argv[1])/'.planning/autodial-ux-audit/py-roundtrip.json',create=True);p.write_text('python-ok');q=artifact_path(artifact_path(Path(sys.argv[1])/'.planning/autodial-ux-audit/python-nested/deep/result.json'),create=True);q.write_text('nested-python-ok')";
 const result=spawnSync(python,['-B','-c',script,api.repository,JSON.stringify(cases)],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),cases.map(rel=>api.artifactPath(path.join(api.repository,rel))));
 assert.equal(fs.readFileSync(api.artifactPath(path.join(api.repository,'.planning/autodial-ux-audit/py-roundtrip.json')),'utf8'),'python-ok');
});

test('nested resolvers create output parents after a path is already external',()=>{
 process.env.ARTIFACTS_ROOT=temp;
 const original=path.join(api.repository,'.planning/autodial-ux-audit/nested-new/deep/result.json');
 const resolved=api.artifactPath(original);
 const output=api.artifactPath(resolved,{write:true});
 fs.writeFileSync(output,'nested-ok');assert.equal(fs.readFileSync(output,'utf8'),'nested-ok');
});
test('only approved CDR outputs route externally; authored inputs and source trees stay',()=>{
 process.env.ARTIFACTS_ROOT=temp;
 for(const name of ['R7O7-CI-SOURCES.json','R7O7-FINAL-COLLECT.json','R7O7-NEW-NATIVE-CDR.json'])assert.equal(api.artifactPath(path.join(api.repository,'.planning/cdr-reports-ux',name)),path.join(temp,'legacy','.planning/cdr-reports-ux',name));
 for(const name of ['SEMANTIC-R4-LABEL-REVIEW.json','SEMANTIC-R6-DISPUTED-LABELS.json','SEMANTIC-R7-REPLAY-SEARCH-CASES.json','R7O2-CI-FIXTURES.json','R7O7-CI-FIXTURES.json','live-ui/package.json','r7o6-preimages/file.ts']){
  const input=path.join(api.repository,'.planning/cdr-reports-ux',name);assert.equal(api.artifactPath(input),input);
 }
});
