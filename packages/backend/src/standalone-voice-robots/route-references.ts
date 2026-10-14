import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

/** Read-only delete backstop for v3 dialplan; no ORM assumptions about legacy routes. */
@Injectable()
export class StandaloneRouteReferences {
  constructor(private readonly config: ConfigService) {}
  // Standalone cannot enumerate the legacy v3 route catalog. Readiness reports the route gate separately.
  async findReferences(_kind: string, _uid: number, _tenant: number) { return []; }
  async assertNotReferenced(_kind: string, uid: number, _tenant: number, message: string): Promise<void> {
    const root = this.config.get<string>('ASTERISK_CONFIG_DIR') || '/etc/asterisk';
    const app = this.config.get<string>('ARI_APP_NAME') || 'mpbx_voice_robots';
    const seen = new Set<string>();
    const scan = async (file: string): Promise<void> => {
      const absolute = path.resolve(file);
      if (seen.has(absolute) || !absolute.startsWith(path.resolve(root) + path.sep)) return;
      seen.add(absolute);
      if (seen.size > 1000) throw new ConflictException('Dialplan reference scan limit');
      const text = await readFile(absolute, 'utf8');
      for (const line of text.split('\n').filter(line => !line.trim().startsWith(';'))) {
        if (line.includes(`Stasis(${app},`) && (line.includes(`,${uid})`) || line.includes(`,${uid},`) || line.includes('${'))) {
          throw new ConflictException(message);
        }
        const include = line.match(/^\s*#(?:try)?include\s+"?([^"\s]+)"?/);
        if (include && !include[1].includes('*')) {
          const target = path.resolve(root, include[1]);
          try { await scan(target); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
        }
      }
    };
    // v3 commonly emits extensions_<tenant>.conf beside extensions.conf.
    const entries = await readdir(root);
    for (const name of entries.filter(name => /^extensions.*\.conf$/.test(name))) await scan(path.join(root, name));
  }
}
