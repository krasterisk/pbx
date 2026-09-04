import * as fs from 'fs';
import * as path from 'path';

/**
 * D-16/D-17 classification of every `src/modules/*` directory.
 *
 * Covered entries must have a registered adapter (via getDomains()).
 * Infrastructure and excluded entries must carry a non-empty reason —
 * a one-word opt-out is indistinguishable from an oversight (T-15-104).
 */
export type CoveredModule = {
  kind: 'covered';
  /** Adapter domain when it differs from the directory name. */
  domain?: string;
  /** Catalog skill name when the domain has no own `src/skills/<dir>/SKILL.md`. */
  sharedSkill?: string;
};

export type ReasonedModule = {
  kind: 'infrastructure' | 'excluded';
  reason: string;
};

export type ModuleCoverageEntry = CoveredModule | ReasonedModule;

/**
 * Populated in the GREEN step. An empty map makes the live completeness
 * test red until every on-disk module directory is classified.
 */
export const MODULE_COVERAGE: Record<string, ModuleCoverageEntry> = {};

export const BACKEND_MODULES_DIR = path.resolve(__dirname, '..');

export function listModuleDirectories(modulesDir: string = BACKEND_MODULES_DIR): string[] {
  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function adapterDomainOf(dir: string, entry: ModuleCoverageEntry): string {
  return entry.kind === 'covered' ? (entry.domain ?? dir) : dir;
}

export function collectCoverageFailures(input: {
  coverage: Record<string, ModuleCoverageEntry>;
  directories: string[];
  registeredDomains: string[];
}): string[] {
  const { coverage, directories, registeredDomains } = input;
  const failures: string[] = [];
  const dirSet = new Set(directories);
  const registered = new Set(registeredDomains);
  const classifiedAdapterDomains = new Set<string>();

  for (const dir of directories) {
    if (!(dir in coverage)) {
      failures.push(`unclassified module directory: ${dir}`);
    }
  }

  for (const key of Object.keys(coverage)) {
    if (!dirSet.has(key)) {
      failures.push(`classified directory missing from filesystem: ${key}`);
    }
  }

  for (const [dir, entry] of Object.entries(coverage)) {
    if (entry.kind === 'covered') {
      const domain = adapterDomainOf(dir, entry);
      classifiedAdapterDomains.add(domain);
      if (!registered.has(domain)) {
        failures.push(`covered domain missing adapter: ${domain}`);
      }
    } else if (!entry.reason.trim()) {
      failures.push(`classification ${dir} (${entry.kind}) has no reason`);
    }
  }

  for (const domain of registeredDomains) {
    if (!classifiedAdapterDomains.has(domain)) {
      failures.push(`registered adapter domain is not classified: ${domain}`);
    }
  }

  return failures;
}
