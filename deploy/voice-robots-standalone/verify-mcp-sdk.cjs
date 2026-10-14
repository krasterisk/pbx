'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { ConfigService } = require('@nestjs/config');
const dist = path.resolve(__dirname, '../../packages/backend/dist-voice-robots');
const { RobotMcpCredentials } = require(path.join(dist, 'standalone-voice-robots/mcp-credentials.js'));
const { StandaloneRobotMcpService, StandaloneRobotMcpController } = require(path.join(dist, 'standalone-voice-robots/mcp.js'));
const { VoiceRobotToolsService } = require(path.join(dist, 'modules/voice-robots/voice-robot-tools.service.js'));
const { VoiceRobotsAiAdapter } = require(path.join(dist, 'modules/voice-robots/voice-robots-ai.adapter.js'));
async function main() {
  const keyFile = path.resolve(__dirname, '../../artifacts/mcp-sdk-test-credentials.json');
  const credentials = new RobotMcpCredentials(new ConfigService({ VOICE_ROBOTS_MCP_CREDENTIALS_FILE: keyFile }));
  const key = credentials.issue(77, { name: 'Temporary SDK verification', scope: 'configure', days: 1 });
  const writes = [];
  const configuration = { write: async (name, args, tenant) => { writes.push({ name, args, tenant }); return { uid: 999, robotId: 999 }; } };
  const service = { findAll: async () => [], testMatch: async (_tenant, _robot, text) => ({ match: { keyword_text: text, confidence: 1 } }) };
  const tools = new VoiceRobotToolsService(service, configuration, {});
  const adapter = new VoiceRobotsAiAdapter(service, {}, { register() {} }, undefined, tools);
  const controller = new StandaloneRobotMcpController(new StandaloneRobotMcpService(adapter, tools));
  const server = http.createServer(async (req, res) => {
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    try {
      req.mcpCredential = credentials.authenticate(req.headers.authorization);
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      if (chunks.length) req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      await controller.handle(req, res);
    } catch { res.statusCode = 401; res.end(); }
  });
  let client;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = new URL(`http://127.0.0.1:${server.address().port}/api/voice-robots-mcp`);
    client = new Client({ name: 'Krasterisk local protocol verification', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: 'Bearer ' + key.token } } }));
    const listed = await client.listTools(); assert.equal(listed.tools.length, 31);
    const skills = await client.callTool({ name: 'list_skills', arguments: {} }); assert.equal(skills.isError, undefined);
    const resource = await client.readResource({ uri: 'krasterisk://voice-robots/agents' }); assert.ok(resource.contents[0].text.includes('Импорт JSON'));
    const schema = await client.readResource({ uri: 'krasterisk://voice-robots/scenario-schema' }); assert.equal(JSON.parse(schema.contents[0].text).type, 'object');
    const prompts = await client.listPrompts(); assert.equal(prompts.prompts.length, 3);
    const prompt = await client.getPrompt({ name: 'setup_voice_robot', arguments: { request: 'Настрой тестового робота' } }); assert.ok(prompt.messages[0].content.text.includes('MCP'));
    const created = await client.callTool({ name: 'create_voice_robot', arguments: { data: { name: 'SDK local mock', active: false } } }); assert.equal(created.isError, undefined);
    assert.equal(writes.length, 1); assert.equal(writes[0].tenant, 77);
    const denied = await client.callTool({ name: 'create_voice_robot', arguments: { data: { name: 'Spoof', user_uid: 88 } } }); assert.equal(denied.isError, true);
    console.log('Actual MCP SDK: initialize/notifications/discovery/31 tools/3 prompts/resources/schema/call/tenant rejection PASS (mock writes; no PBX/DB/calls)');
  } finally {
    if (client) await client.close();
    await new Promise(resolve => server.close(resolve));
    credentials.revoke(77, key.id);
    fs.unlinkSync(keyFile);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
