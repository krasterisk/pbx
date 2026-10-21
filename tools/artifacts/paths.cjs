'use strict';
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { fileURLToPath } = require('node:url');
const policy = require('./policy.json');
const repository = path.resolve(__dirname, '../..');
const preserved = new Set(policy.preserve);
function within(base, target) {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
function artifactsRoot() {
  const configured = process.env.ARTIFACTS_ROOT;
  if (configured && !path.isAbsolute(configured)) throw new Error('ARTIFACTS_ROOT must be absolute');
  const root = path.resolve(configured || path.join(os.homedir(), 'Documents', 'DevArtifacts', 'krasterisk_v4'));
  if (within(repository, root) || within(root, repository)) throw new Error('ARTIFACTS_ROOT must be outside and separate from the repository');
  // Resolve existing ancestors to reject junction/symlink aliases into the checkout.
  let ancestor = root;
  while (!fs.existsSync(ancestor) && path.dirname(ancestor) !== ancestor) ancestor = path.dirname(ancestor);
  const real = fs.realpathSync(ancestor);
  const realRoot = path.resolve(real, path.relative(ancestor, root));
  const realRepository = fs.realpathSync(repository);
  if (within(realRepository, realRoot) || within(realRoot, realRepository)) throw new Error('ARTIFACTS_ROOT resolves inside/around the repository');
  return root;
}
function isArtifact(relative) {
  const rel = relative.replaceAll('\\', '/');
  if (preserved.has(rel)) return false;
  if ((policy.additionalArtifactPaths || []).includes(rel) || (policy.additionalArtifactDirectories || []).some(dir => rel === dir || rel.startsWith(dir + '/')) || (policy.additionalArtifactPatterns || []).some(pattern => new RegExp(pattern).test(rel))) return true;
  if (policy.excludedScopes.some(scope => rel === scope || rel.startsWith(scope + '/'))) return false;
  if (policy.outputRoots.some(root => rel === root.slice(0, -1) || rel.startsWith(root))) return true;
  if (!rel.startsWith('.planning/')) return false;
  const parts = rel.split('/');
  if (parts.some(p => /^(backend|frontend|shared)(-runtime)?-dist($|-)/.test(p) || p.startsWith('.vite') || ['__pycache__', 'tts-cache', 'sapi-cache', 'reranker-cache'].includes(p))) return true;
  if (policy.generatedExtensions.includes(path.posix.extname(rel).toLowerCase())) return true;
  const name = parts.at(-1).toLowerCase();
  return name.endsWith('.json') && policy.jsonScopes.some(scope => rel.startsWith(scope)) && !policy.jsonPreserveWords.some(word => name.includes(word));
}
function artifactPath(value, options = {}) {
  if (value instanceof URL) { if (value.protocol !== 'file:') return value; value = fileURLToPath(value); }
  if (typeof value !== 'string' || value.includes('\n') || value.includes('\0')) return value;
  const full = path.resolve(value);
  if (!within(repository, full)) {
    // A constructor/path.join may already have resolved this path before the write wrapper.
    const candidate = path.resolve(process.env.ARTIFACTS_ROOT || path.join(os.homedir(), 'Documents', 'DevArtifacts', 'krasterisk_v4'));
    if (options.write && within(candidate, full)) {
      const validated = artifactsRoot();
      if (within(validated, full)) fs.mkdirSync(path.dirname(full), { recursive: true });
    }
    return value;
  }
  const relative = path.relative(repository, full).split(path.sep).join('/');
  if (!isArtifact(relative)) return value;
  const result = path.join(artifactsRoot(), 'legacy', relative);
  if (options.write) fs.mkdirSync(path.dirname(result), { recursive: true });
  return result;
}
function outputPath(...parts) {
  if (parts.some(p => typeof p !== 'string' || p === '..' || p.split(/[\\/]/).includes('..') || path.isAbsolute(p))) throw new Error('Artifact output segments must stay relative');
  return path.join(artifactsRoot(), ...parts);
}
module.exports = { artifactPath, artifactsRoot, outputPath, isArtifact, repository };
if (require.main === module) console.log(process.argv[2] === '--output' ? outputPath(...process.argv.slice(3)) : process.argv[2] ? artifactPath(path.resolve(repository, process.argv[2])) : artifactsRoot());
