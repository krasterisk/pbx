'use strict';
// Local artifacts use ARTIFACTS_ROOT; standalone remote lab copies retain their remote paths.
const _artifactModule = "./../../tools/artifacts/paths.cjs";
const _artifactPath = require('node:fs').existsSync(require('node:path').resolve(__dirname, _artifactModule)) ? require(_artifactModule).artifactPath : (value) => value;

// Metadata-only export: no application bootstrap, database, listeners or credentials.
const { outputPath } = require('../artifacts/paths.cjs');
const path = require('node:path');
const fs = require('node:fs');
const root = _artifactPath(path.resolve(__dirname, '../..'));
process.env.TS_NODE_PROJECT = _artifactPath(path.join(root, 'packages/backend/tsconfig.json'));
require('ts-node/register/transpile-only');
const source = (file) => require(_artifactPath(path.join(root, 'packages/backend/src', file)));
const { Test } = require('@nestjs/testing');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AutodialCrmController } = source('modules/autodial/autodial-crm.controller');
const { AutodialIntegrationKeysController } = source('modules/autodial-integration/autodial-integration-keys.controller');
const { AutodialCrmService } = source('modules/autodial/autodial-crm.service');
const { AutodialBasesService } = source('modules/autodial/autodial-bases.service');
const { AutodialWebhooksService } = source('modules/autodial/autodial-webhooks.service');
const { AutodialIntegrationKeyService } = source('modules/autodial-integration/autodial-integration-key.service');
const { AutodialIntegrationKeyGuard } = source('modules/autodial-integration/autodial-integration-key.guard');
const { JwtAuthGuard } = source('modules/auth/jwt-auth.guard');
const { ModuleAccessGuard } = source('modules/cloud-admin/module-access.guard');
(async () => {
  let builder = Test.createTestingModule({ controllers: [AutodialCrmController, AutodialIntegrationKeysController],
    providers: [AutodialCrmService, AutodialBasesService, AutodialWebhooksService, AutodialIntegrationKeyService].map((provide) => ({ provide, useValue: {} })) });
  for (const guard of [AutodialIntegrationKeyGuard, JwtAuthGuard, ModuleAccessGuard]) builder = builder.overrideGuard(guard).useValue({ canActivate: () => false });
  const module = await builder.compile(), app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Krasterisk Autodial CRM API')
    .setVersion('1').setDescription('Scoped autodial integration. See AUTODIAL_CRM_API.md for scopes, retries and HMAC verification.').addBearerAuth().build());
  const output = outputPath('runs', 'autodial', 'openapi-' + Date.now(), 'AUTODIAL_CRM_OPENAPI.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(doc, null, 2) + '\n');
  await app.close(); console.log(`Exported ${Object.keys(doc.paths).length} paths to ${output}; no network or database used.`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
