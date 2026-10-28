'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRestartController, terminateOwnedChild, buildFingerprint } = require('./nest-watch.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tick = () => new Promise(resolve => setImmediate(resolve));
const child = pid => Object.assign(new EventEmitter(), { pid, exitCode: null, signalCode: null });

test('rapid build notifications wait for one exit and spawn only the newest build', async () => {
  const children = [], stopped = [], errors = [];
  const controller = createRestartController({
    spawn: () => { const next = child(children.length + 1); children.push(next); return next; },
    terminate: previous => stopped.push(previous.pid),
    onError: error => errors.push(error),
  });
  controller.request(); controller.request(); controller.request(); await controller.idle();
  assert.equal(children.length, 1);
  controller.request(); await tick();
  controller.request(); controller.request(); controller.request();
  assert.deepEqual(stopped, [1]); assert.equal(children.length, 1);
  children[0].exitCode = 0; children[0].emit('exit', 0); await controller.idle();
  assert.equal(children.length, 2); assert.deepEqual(errors, []);
  const stopping = controller.stop(); await tick();
  children[1].exitCode = 0; children[1].emit('exit', 0); await stopping;
  controller.request(); await controller.idle(); assert.equal(children.length, 2);
});

test('a taskkill error for an already gone process cannot terminate the watcher', () => {
  const previous = child(17);
  assert.doesNotThrow(() => terminateOwnedChild(previous, () => { throw Object.assign(new Error('already gone'), { status: 255 }); }, () => false));
  assert.throws(() => terminateOwnedChild(previous, () => { throw new Error('access denied'); }, () => true), /access denied/);
});

test('a genuine termination failure preserves the live child and allows a later retry', async () => {
  const previous = child(1); const errors = []; let fail = true; let spawned = 0;
  const controller = createRestartController({ spawn: () => { spawned++; return previous; }, terminate: () => { if (fail) throw new Error('denied'); previous.exitCode = 0; previous.emit('exit', 0); }, onError: error => errors.push(error) });
  controller.request(); await controller.idle(); controller.request(); await controller.idle();
  assert.equal(errors.length, 1); assert.equal(spawned, 1);
  fail = false; await controller.stop(); assert.equal(spawned, 1);
});

test('an unexpected child exit does not leave a stale PID for the next build', async () => {
  const children = []; const stopped = [];
  const controller = createRestartController({spawn: () => {const next = child(children.length+1);children.push(next);return next;}, terminate: previous => {stopped.push(previous.pid);previous.exitCode=0;previous.emit('exit',0);} });
  controller.request(); await controller.idle(); children[0].exitCode=1;children[0].emit('exit',1);
  controller.request(); await controller.idle(); assert.equal(children.length,2);assert.deepEqual(stopped,[]);
  await controller.stop();assert.deepEqual(stopped,[2]);
});

test('unchanged output keeps its live process; real new output restarts once', async () => {
  const children = [], stopped = [];
  const controller = createRestartController({spawn: () => { const next=child(children.length+1);children.push(next);return next; },terminate: previous => {stopped.push(previous.pid);previous.exitCode=0;previous.emit('exit',0);}});
  assert.equal(controller.request('build-A'),true); await controller.idle();
  assert.equal(controller.request('build-A'),false); await controller.idle();
  assert.equal(children.length,1);assert.deepEqual(stopped,[]);
  controller.request('build-B'); controller.request('build-B');await controller.idle();
  assert.equal(children.length,2);assert.deepEqual(stopped,[1]);
  children[1].exitCode=1;children[1].emit('exit',1);
  assert.equal(controller.request('build-B'),true);await controller.idle();assert.equal(children.length,3);
  await controller.stop();
});

test('the same pending build can retry after a genuine termination failure', async () => {
  const children=[],errors=[];let fail=true;
  const controller=createRestartController({spawn:()=>{const next=child(children.length+1);children.push(next);return next;},terminate:previous=>{if(fail)throw Error('denied');previous.exitCode=0;previous.emit('exit',0);},onError:error=>errors.push(error)});
  controller.request('A');await controller.idle();controller.request('B');await controller.idle();
  assert.equal(errors.length,1);assert.equal(children.length,1);
  fail=false;assert.equal(controller.request('B'),true);await controller.idle();assert.equal(children.length,2);await controller.stop();
});

test('build comparison uses contents and dependencies, ignoring unchanged writes and declaration metadata', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nest-watch-'));t.after(()=>{
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('nest-watch-'));
    fs.rmSync(root,{recursive:true,force:true});
  });
  const dist=path.join(root,'dist');fs.mkdirSync(dist);
  const js=path.join(dist,'main.js'),types=path.join(dist,'main.d.ts'),map=path.join(dist,'main.js.map'),lock=path.join(root,'lock.json');
  fs.writeFileSync(js,'module.exports=1');fs.writeFileSync(types,'declare const x:1;');fs.writeFileSync(map,'{}');fs.writeFileSync(lock,'{"version":1}');
  const initial=buildFingerprint(dist,[lock]);fs.writeFileSync(js,'module.exports=1');fs.writeFileSync(types,'declare const x:2;');fs.writeFileSync(map,'{"mappings":"changed"}');
  assert.equal(buildFingerprint(dist,[lock]),initial);
  const debug=buildFingerprint(dist,[lock],true);fs.writeFileSync(map,'{}');assert.notEqual(buildFingerprint(dist,[lock],true),debug);
  fs.writeFileSync(js,'module.exports=2');const codeChanged=buildFingerprint(dist,[lock]);assert.notEqual(codeChanged,initial);
  fs.writeFileSync(lock,'{"version":2}');assert.notEqual(buildFingerprint(dist,[lock]),codeChanged);
});

test('late asset copies do not restart an unchanged build; source asset changes do', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nest-watch-'));t.after(()=>{
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('nest-watch-'));fs.rmSync(root,{recursive:true,force:true});
  });
  const dist=path.join(root,'dist'),source=path.join(root,'src');fs.mkdirSync(dist);fs.mkdirSync(source);
  fs.writeFileSync(path.join(dist,'main.js'),'module.exports=1');fs.writeFileSync(path.join(source,'config.cjs'),'module.exports=1');
  const initial=buildFingerprint(dist,[],false,source);
  fs.copyFileSync(path.join(source,'config.cjs'),path.join(dist,'config.cjs'));assert.equal(buildFingerprint(dist,[],false,source),initial);
  fs.writeFileSync(path.join(source,'config.cjs'),'module.exports=2');assert.notEqual(buildFingerprint(dist,[],false,source),initial);
});
