import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ContextInclude } from './context-include.model';
import { Context } from '../contexts/context.model';

@Injectable()
export class ContextIncludesService {
  constructor(
    @InjectModel(ContextInclude) private ciModel: typeof ContextInclude,
    @InjectModel(Context) private contextModel: typeof Context,
  ) {}

  /** Get all includes for a context */
  async findByContext(contextUid: number, vpbxUserUid: number): Promise<any[]> {
    const includes = await this.ciModel.findAll({
      where: { context_uid: contextUid, user_uid: vpbxUserUid },
      order: [['priority', 'ASC']],
    });

    // Enrich with context names
    const includeUids = includes.map((i) => i.include_uid);
    if (includeUids.length === 0) return [];

    const contexts = await this.contextModel.findAll({
      where: { uid: includeUids },
    });
    const ctxMap = new Map(contexts.map((c) => [c.uid, c]));

    return includes.map((inc) => ({
      uid: inc.uid,
      context_uid: inc.context_uid,
      include_uid: inc.include_uid,
      include_name: ctxMap.get(inc.include_uid)?.name || '',
      include_comment: ctxMap.get(inc.include_uid)?.comment || '',
      priority: inc.priority,
    }));
  }

  /** Add an include to a context */
  async add(contextUid: number, includeUid: number, vpbxUserUid: number): Promise<ContextInclude> {
    // prevent circular reference
    if (contextUid === includeUid) {
      throw new Error('A context cannot include itself');
    }

    // Get max priority
    const maxPriority = await this.ciModel.max('priority', {
      where: { context_uid: contextUid, user_uid: vpbxUserUid },
    }) as number | null;

    return this.ciModel.create({
      context_uid: contextUid,
      include_uid: includeUid,
      priority: (maxPriority || 0) + 1,
      user_uid: vpbxUserUid,
    } as any);
  }

  /** Remove an include */
  async remove(uid: number, vpbxUserUid: number): Promise<void> {
    const inc = await this.ciModel.findOne({ where: { uid, user_uid: vpbxUserUid } });
    if (!inc) throw new NotFoundException('Include not found');
    await inc.destroy();
  }

  /** Get context names for includes (used in dialplan generation) */
  async getIncludeNames(contextUid: number, vpbxUserUid: number): Promise<string[]> {
    const includes = await this.findByContext(contextUid, vpbxUserUid);
    return includes.map((i) => i.include_name);
  }
}
