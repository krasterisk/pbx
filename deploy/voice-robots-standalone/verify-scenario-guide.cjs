'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const loaded = new Map();
function frontend(name) {
  if (loaded.has(name)) return loaded.get(name);
  const source = fs.readFileSync(path.join(root, 'packages/frontend/src/features/voiceRobots/model', name + '.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', output)(specifier => frontend(specifier.slice(2)), module, module.exports);
  loaded.set(name, module.exports); return module.exports;
}
async function main() {
  const { parseScenarioExport, buildScenarioExport } = frontend('scenarioExport');
  const { applyScenarioImport } = frontend('applyScenarioImport');
  const { validateScenario } = require(path.join(root, 'packages/backend/dist-voice-robots/modules/voice-robots/voice-robot-scenario.js'));
  for (const filename of fs.readdirSync(path.join(__dirname, 'public/examples'))) {
    const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/examples', filename), 'utf8'));
    assert.equal(validateScenario(file).valid, true, filename);
    let next = 400; const groups = []; const dataLists = []; const keywordsByGroupId = {}; let robot;
    const result = await applyScenarioImport(parseScenarioExport(file), {
      createDataList: async data => { const row = { ...data, uid: ++next }; dataLists.push(row); return row; },
      createGroup: async data => { const row = { ...data, uid: ++next }; groups.push(row); return row; },
      createKeyword: async (id, data) => { const row = { ...data, uid: ++next, group_id: id }; (keywordsByGroupId[id] ||= []).push(row); return row; },
      updateRobot: async patch => { robot = patch; },
    });
    assert.equal(result.groups, file.scenario.groups.length);
    assert.ok(groups.some(g => g.uid === robot.initial_group_id));
    const roundtrip = buildScenarioExport({ robot, groups, dataLists, keywordsByGroupId });
    const checked = validateScenario(roundtrip); assert.equal(checked.valid, true, checked.errors.join('; '));
    console.log(filename + ': actual frontend parser/importer/exporter + backend structural/reference validation PASS');
  }
  for (const name of ['voice-robots', 'voice-robot-scenarios', 'voice-robot-testing']) {
    const body = fs.readFileSync(path.join(root, 'packages/backend/src/skills', name, 'SKILL.md'), 'utf8');
    assert.ok(body.length < 8000, name + ': skill must fit prompt budget');
  }
  const guide = fs.readFileSync(path.join(__dirname, 'public/AGENTS.md'), 'utf8');
  let completeExamples = 0;
  for (const match of guide.matchAll(/```json\s*([\s\S]*?)```/g)) {
    const value = JSON.parse(match[1]);
    if (value.format === 'krasterisk.voice-robot.scenario') {
      assert.equal(validateScenario(parseScenarioExport(value)).valid, true, 'Inline complete scenario');
      await applyScenarioImport(value, { createGroup: async () => ({ uid: 777 }), createKeyword: async (_id, data) => data,
        createDataList: async () => ({ uid: 778 }), updateRobot: async patch => { assert.equal(patch.initial_group_id, 777); } });
      completeExamples++;
    }
  }
  assert.ok(completeExamples > 0, 'Guide must be self-contained for an offline model');
  assert.ok(guide.includes('Если MCP') && guide.includes('Импорт JSON') && guide.includes('Журнал звонков'));
  console.log('Guide/skills budgets and required fallback/setup/testing instructions PASS');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
