'use strict';
// Read-only, offline comparison of the AppModule model set and immutable MySQL 0001.
// This is inventory input for DB-02-A, not a migration generator or installer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const backend = path.resolve(__dirname, '../../packages/backend');
const appPath = path.join(backend, 'src/app.module.ts');
const sqlPath = path.join(backend, 'database/migrations/0001-current-schema.sql');
const source = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const decorators = node => ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
const decorator = (node, name) => decorators(node).map(d => d.expression).find(e =>
  (ts.isCallExpression(e) ? e.expression : e).getText().split('.').at(-1) === name);
const callArg = expression => expression && ts.isCallExpression(expression) ? expression.arguments[0] : undefined;
const property = (object, name) => object && ts.isObjectLiteralExpression(object) ? object.properties.find(p =>
  ts.isPropertyAssignment(p) && p.name.getText().replace(/^['"]|['"]$/g, '') === name)?.initializer : undefined;
const value = node => node && (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) ? node.text : undefined;
const code = node => node?.getText() ?? null;
const portableText = node => node?.getText().replace(/\r\n?/g, '\n') ?? null;
const canonicalType = type => {
  if (!type) return null;
  const compact = type.replace(/\s*,\s*/g, ',').replace(/^DataType\./, '');
  if (compact.startsWith('ENUM(')) return `ENUM(${[...compact.matchAll(/'((?:[^']|'')*)'/g)].map(match => `'${match[1]}'`).join(',')})`;
  if (compact.endsWith('.UNSIGNED')) return compact.replace('.UNSIGNED', ' UNSIGNED');
  if (compact === 'STRING') return 'VARCHAR(255)';
  if (compact.startsWith('STRING(')) return compact.replace(/^STRING/, 'VARCHAR');
  if (compact === 'DATE') return 'DATETIME';
  if (compact === 'DATEONLY') return 'DATE';
  if (compact === 'BOOLEAN') return 'TINYINT(1)';
  if (compact === 'TEXT') return 'TEXT';
  if (compact === "TEXT('medium')") return 'MEDIUMTEXT';
  return compact;
};
const baselineType = definition => {
  if (definition.startsWith('ENUM(')) {
    const end = definition.indexOf(')');
    if (end < 0) throw new Error(`Invalid ENUM column: ${definition}`);
    return definition.slice(0, end + 1).replace(/\s*,\s*/g, ',');
  }
  const match = /^([A-Z]+(?:\([^)]*\))?(?: UNSIGNED)?)/.exec(definition);
  if (!match) throw new Error(`Unknown baseline type: ${definition}`);
  return match[1];
};

function splitTopLevel(input) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quote) {
      if (char === '\\') { i++; continue; }
      if (char === quote) {
        if (input[i + 1] === quote && quote !== '`') { i++; continue; }
        quote = null;
      }
    } else if (char === '`' || char === "'" || char === '"') quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      result.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (quote || depth !== 0) throw new Error('Unbalanced SQL definition');
  result.push(input.slice(start).trim());
  return result;
}

function baselineInventory() {
  const bytes = fs.readFileSync(sqlPath);
  const sql = bytes.toString('utf8');
  const tables = {};
  for (const line of sql.split(/\r?\n/)) {
    if (!line.startsWith('CREATE TABLE IF NOT EXISTS ')) continue;
    const match = /^CREATE TABLE IF NOT EXISTS `([^`]+)` \((.*)\) ENGINE=InnoDB DEFAULT CHARSET=([^ ]+)(?: .*)?;$/.exec(line);
    if (!match) throw new Error(`Unrecognized baseline SQL table: ${line.slice(0, 90)}`);
    const [, name, definition, charset] = match;
    if (tables[name]) throw new Error(`Duplicate baseline table: ${name}`);
    const columns = {};
    const constraints = [];
    for (const item of splitTopLevel(definition)) {
      const column = /^`([^`]+)` (.*)$/.exec(item);
      if (column) columns[column[1]] = column[2];
      else constraints.push(item);
    }
    tables[name] = { columns, constraints, charset };
  }
  return { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), tables };
}

function exportedModelNames(file, exportName) {
  const ast = source(file);
  const statement = ast.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && decl.name.text === exportName));
  if (!statement || !ts.isVariableStatement(statement)) throw new Error(`Missing ${exportName} in ${path.relative(backend, file)}`);
  let initializer = statement.declarationList.declarations[0].initializer;
  while (initializer && (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer)
    || ts.isTypeAssertionExpression(initializer) || ts.isSatisfiesExpression(initializer))) {
    initializer = initializer.expression;
  }
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) throw new Error(`${exportName} is not an array`);
  const imports = new Map();
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const spec of bindings.elements) {
      imports.set(spec.name.text, path.resolve(path.dirname(file), node.moduleSpecifier.text) + '.ts');
    }
  }
  return initializer.elements.map(element => {
    if (!ts.isIdentifier(element)) throw new Error(`Dynamic ${exportName} model: ${element.getText(ast)}`);
    const modelFile = imports.get(element.text);
    if (!modelFile || !fs.existsSync(modelFile)) throw new Error(`Cannot resolve model ${element.text}`);
    return { name: element.text, file: modelFile };
  });
}

function appModels() {
  const groups = [
    exportedModelNames(path.join(backend, 'src/compositions/pbx-core.composition.ts'), 'PBX_CORE_MODELS'),
    exportedModelNames(path.join(backend, 'src/compositions/commercial-ai.composition.ts'), 'COMMERCIAL_AI_MODELS'),
  ];
  const names = groups.flat();
  if (!names.length || new Set(names.map(item => item.name)).size !== names.length) {
    throw new Error('Missing or duplicate AppModule models');
  }
  return names;
}

function modelInventory() {
  const tables = {};
  for (const { name, file } of appModels()) {
    const ast = source(file);
    const cls = ast.statements.find(s => ts.isClassDeclaration(s) && s.name?.text === name);
    if (!cls) throw new Error(`Model class ${name} absent in ${file}`);
    const table = decorator(cls, 'Table');
    if (!table) throw new Error(`Model ${name} lacks @Table`);
    const tableName = value(property(callArg(table), 'tableName'));
    if (!tableName || tables[tableName]) throw new Error(`Missing/duplicate tableName for ${name}`);
    const schemaMetadata = {
      classDecorators: decorators(cls).map(item => portableText(item.expression)),
      members: cls.members.filter(member => decorators(member).length).map(member => ({
        name: portableText(member.name),
        declaredType: portableText(member.type),
        decorators: decorators(member).map(item => portableText(item.expression)),
      })),
    };
    const columns = {};
    for (const member of cls.members) {
      const column = decorator(member, 'Column');
      const created = decorator(member, 'CreatedAt');
      const updated = decorator(member, 'UpdatedAt');
      if (!column && !created && !updated) continue;
      if (!member.name || !ts.isIdentifier(member.name)) throw new Error(`Dynamic column in ${name}`);
      const options = column && callArg(column);
      const field = value(property(options, 'field')) || member.name.text;
      if (columns[field]) throw new Error(`Duplicate column ${tableName}.${field}`);
      columns[field] = {
        member: member.name.text,
        type: code(property(options, 'type') || (options && !ts.isObjectLiteralExpression(options) ? options : undefined)),
        allowNull: code(property(options, 'allowNull') || callArg(decorator(member, 'AllowNull'))),
        defaultValue: code(property(options, 'defaultValue') || callArg(decorator(member, 'Default'))),
        primaryKey: !!decorator(member, 'PrimaryKey') || code(property(options, 'primaryKey')) === 'true',
        autoIncrement: !!decorator(member, 'AutoIncrement') || code(property(options, 'autoIncrement')) === 'true',
        foreignKey: code(callArg(decorator(member, 'ForeignKey'))),
        timestamp: created ? 'created' : updated ? 'updated' : null,
      };
    }
    // sequelize-typescript @Table defaults timestamps to true; Sequelize adds
    // these columns even when the class has no explicit decorated members.
    const tableOptions = callArg(table);
    if (code(property(tableOptions, 'timestamps')) !== 'false') {
      for (const [option, fallback] of [['createdAt', 'createdAt'], ['updatedAt', 'updatedAt']]) {
        const configured = property(tableOptions, option);
        if (code(configured) === 'false') continue;
        const kind = option === 'createdAt' ? 'created' : 'updated';
        if (Object.values(columns).some(column => column.timestamp === kind)) continue;
        const field = value(configured) || fallback;
        if (!columns[field]) columns[field] = {
          member: null, type: 'DataType.DATE', allowNull: 'false', defaultValue: null,
          primaryKey: false, autoIncrement: false, foreignKey: null, timestamp: option === 'createdAt' ? 'created' : 'updated',
        };
      }
    }
    tables[tableName] = { model: name, file: path.relative(backend, file).replaceAll('\\', '/'), columns,
      indexes: code(property(tableOptions, 'indexes')), tableOptions: code(tableOptions),
      schemaMetadataSha256: crypto.createHash('sha256').update(JSON.stringify(schemaMetadata)).digest('hex') };
  }
  return tables;
}

function inventory() {
  const baseline = baselineInventory();
  const allModels = modelInventory();
  // 0001 is immutable. Models introduced by an additive migration are checked
  // against that migration separately, not retroactively assigned to 0001.
  const additiveNames = [
    'ai_product_activation', 'ai_local_license_documents', 'ai_local_license_bindings',
    'ai_integration_principals', 'ai_integration_credentials', 'ai_integration_grants',
    'ai_integration_audit', 'ai_integration_commands', 'ai_integration_auth_limits',
    'ai_provider_revisions', 'ai_media_assets', 'ai_uploads', 'ai_idempotency',
    'ai_jobs', 'ai_job_stages', 'ai_provider_operations', 'ai_outbox', 'ai_job_events',
    'ai_quota_counters', 'ai_usage_reservations', 'ai_usage_events', 'ai_price_revisions',
    'ai_usage_ledger',
  ];
  const additiveModels = Object.fromEntries(additiveNames.map(name => [name, allModels[name]]));
  if (additiveNames.some(name => !allModels[name])) throw new Error('Missing additive AI product model');
  const models = Object.fromEntries(Object.entries(allModels).filter(([name]) => !additiveNames.includes(name)));
  const baselineNames = Object.keys(baseline.tables);
  const modelNames = Object.keys(models);
  const modelMetadataSha256 = crypto.createHash('sha256').update(JSON.stringify(modelNames.sort().map(name =>
    [name, models[name].schemaMetadataSha256]))).digest('hex');
  const differences = {
    modelTablesAbsentFromBaseline: modelNames.filter(name => !baseline.tables[name]),
    baselineTablesAbsentFromModels: baselineNames.filter(name => !models[name]),
    modelColumnsAbsentFromBaseline: [],
    baselineColumnsAbsentFromModels: [],
    typeDifferences: [],
    intentionalTypeWidenings: [],
    nullabilityDifferences: [],
  };
  for (const name of modelNames.filter(name => baseline.tables[name])) {
    const modelColumns = Object.keys(models[name].columns);
    const baselineColumns = Object.keys(baseline.tables[name].columns);
    for (const column of modelColumns.filter(column => !baseline.tables[name].columns[column])) differences.modelColumnsAbsentFromBaseline.push(`${name}.${column}`);
    for (const column of baselineColumns.filter(column => !models[name].columns[column])) differences.baselineColumnsAbsentFromModels.push(`${name}.${column}`);
    for (const column of modelColumns.filter(column => baseline.tables[name].columns[column])) {
      const model = models[name].columns[column];
      const definition = baseline.tables[name].columns[column];
      const expected = canonicalType(model.type);
      const actual = baselineType(definition);
      if (expected && expected !== actual) {
        const detail = `${name}.${column}: model=${expected} baseline=${actual}`;
        if (name === 'ps_endpoints' && expected === 'VARCHAR(40)' && actual === 'TEXT') differences.intentionalTypeWidenings.push(detail);
        else differences.typeDifferences.push(detail);
      }
      if (model.allowNull === 'false' && !/\bNOT NULL\b/.test(definition) && !model.primaryKey) differences.nullabilityDifferences.push(`${name}.${column}: model=NOT NULL baseline=NULL`);
      if (model.allowNull === 'true' && /\bNOT NULL\b/.test(definition)) differences.nullabilityDifferences.push(`${name}.${column}: model=NULL baseline=NOT NULL`);
    }
  }
  for (const rows of Object.values(differences)) rows.sort();
  return { version: 1, sources: { appModule: path.relative(backend, appPath).replaceAll('\\', '/'), baseline: path.relative(backend, sqlPath).replaceAll('\\', '/'), baselineSha256: baseline.sha256, modelMetadataSha256 },
    counts: { models: modelNames.length, additiveModels: additiveNames.length, baselineTables: baselineNames.length, modelColumns: Object.values(models).reduce((n, t) => n + Object.keys(t.columns).length, 0), baselineColumns: Object.values(baseline.tables).reduce((n, t) => n + Object.keys(t.columns).length, 0) },
    ownership: { 'ps_*': 'Asterisk realtime/PJSIP schema and DB-03 writer contract', cdr: 'Asterisk CDR/ODBC plus application model; DB-03 writer contract', 'queues/queue_members': 'Asterisk queue realtime plus application model; DB-03 writer contract', queue_log: 'DB-03; absent from Sequelize baseline', cel: 'DB-03 policy pending; absent from Sequelize baseline' },
    differences, models, additiveModels, baselineTables: baseline.tables };
}

if (require.main === module) {
  try { process.stdout.write(JSON.stringify(inventory(), null, 2) + '\n'); }
  catch (error) { process.stderr.write(`Schema inventory failed: ${error.message}\n`); process.exitCode = 1; }
}
module.exports = { inventory, splitTopLevel };
