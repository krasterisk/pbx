'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it } = require('node:test');
const { applyAppVersion, parseAppVersion } = require('./app-version.cjs');

describe('application version', () => {
  it('parses generation 4 with a build number', () => {
    assert.deepEqual(parseAppVersion('4.7.1.0'), {
      generation: 4, line: 7, change: 1, build: 0, version: '4.7.1.0', npmVersion: '4.7.1',
    });
    assert.equal(parseAppVersion('4.10.0.25').npmVersion, '4.10.0');
  });

  it('rejects a missing build, another generation, and leading zeros', () => {
    for (const value of ['4.7.1', '4.7', '5.0.0.0', '4.07.1.0', '4.7.1.0.1', 'v4.7.1.0']) {
      assert.throws(() => parseAppVersion(value), /4\.<line>\.<change>\.<build>/);
    }
  });

  it('writes one application version through the workspace manifests', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-version-'));
    try {
    const manifests = {
      'package.json': {
        name: 'krasterisk-v4',
        version: '0.0.1',
        workspaces: ['packages/shared', 'packages/backend', 'packages/frontend', 'harness'],
      },
      'packages/backend/package.json': { name: '@krasterisk/backend', version: '0.0.1', dependencies: { keyv: '4.5.4' } },
      'packages/frontend/package.json': { name: '@krasterisk/frontend', version: '0.0.1' },
      'packages/shared/package.json': { name: '@krasterisk/shared', version: '1.0.0' },
      'harness/package.json': { name: '@krasterisk/harness', version: '0.1.0' },
    };
    for (const [rel, json] of Object.entries(manifests)) {
      const file = path.join(root, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    }
    const constantDir = path.join(root, 'packages', 'shared', 'src');
    fs.mkdirSync(constantDir, { recursive: true });
    fs.writeFileSync(path.join(constantDir, 'app-version.ts'), "export const APP_VERSION = '0.0.0.0';\n");
    fs.writeFileSync(path.join(root, 'package-lock.json'), `${JSON.stringify({
      name: 'krasterisk-v4',
      version: '0.0.1',
      lockfileVersion: 3,
      packages: {
        '': { name: 'krasterisk-v4', version: '0.0.1' },
        harness: { name: '@krasterisk/harness', version: '0.1.0' },
        'packages/backend': { name: '@krasterisk/backend', version: '0.0.1', dependencies: { keyv: '4.5.4' } },
        'packages/frontend': { name: '@krasterisk/frontend', version: '0.0.1' },
        'packages/shared': { name: '@krasterisk/shared', version: '1.0.0' },
        'node_modules/keyv': { name: 'keyv', version: '4.5.4' },
      },
    }, null, 2)}\n`);

    const app = applyAppVersion('4.7.2.3', root);
    assert.equal(app.version, '4.7.2.3');
    assert.equal(app.npmVersion, '4.7.2');
    const backend = JSON.parse(fs.readFileSync(path.join(root, 'packages/backend/package.json'), 'utf8'));
    assert.equal(backend.version, '4.7.2');
    assert.equal(backend.dependencies.keyv, '4.5.4');
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    assert.equal(lock.version, '4.7.2');
    assert.equal(lock.packages['node_modules/keyv'].version, '4.5.4');
    assert.equal(fs.readFileSync(path.join(constantDir, 'app-version.ts'), 'utf8'), "export const APP_VERSION = '4.7.2.3';\n");
    const once = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
    applyAppVersion('4.7.2.3', root);
    assert.equal(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'), once);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
