import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MohClass } from './moh-class.model';
import { MohEntry } from './moh-entry.model';
import { AmiService } from '../ami/ami.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MohService {
  private readonly logger = new Logger(MohService.name);
  private readonly soundsBasePath: string;

  constructor(
    @InjectModel(MohClass) private mohClassModel: typeof MohClass,
    @InjectModel(MohEntry) private mohEntryModel: typeof MohEntry,
    private readonly amiService: AmiService,
    private readonly configService: ConfigService,
  ) {
    this.soundsBasePath = this.configService.get<string>(
      'ASTERISK_SOUNDS_PATH',
      '/var/lib/asterisk/sounds/krasterisk',
    );
  }

  /**
   * Generate a safe Asterisk MOH class name from a display name.
   * Format: moh_{userUid}_{slug}
   * Only [a-z0-9_], max 80 chars (Asterisk limit).
   */
  generateClassName(displayName: string, userUid: number): string {
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]/gi, '_')
      // transliterate basic Cyrillic
      .replace(/[а-яё]/g, (c) => {
        const map: Record<string, string> = {
          а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
          ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
          н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
          ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
          ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
        };
        return map[c] || c;
      })
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const prefix = `moh_${userUid}_`;
    const maxSlugLen = 80 - prefix.length;
    return prefix + slug.substring(0, maxSlugLen);
  }

  /**
   * Extract human-readable display name from the Asterisk class name.
   * moh_15_sales_hold → sales_hold
   */
  extractDisplayName(className: string): string {
    const parts = className.split('_');
    // Remove "moh" and user_uid prefix
    if (parts.length >= 3 && parts[0] === 'moh') {
      return parts.slice(2).join('_');
    }
    return className;
  }

  async findAll(userUid: number): Promise<any[]> {
    const classes = await this.mohClassModel.findAll({
      where: { user_uid: userUid },
      order: [['name', 'ASC']],
    });

    // Fetch entries for each class
    const result = [];
    for (const cls of classes) {
      const entries = await this.mohEntryModel.findAll({
        where: { name: cls.name },
        order: [['position', 'ASC']],
      });
      result.push({
        ...cls.toJSON(),
        displayName: this.extractDisplayName(cls.name),
        entries: entries.map((e) => e.toJSON()),
      });
    }
    return result;
  }

  async findOne(name: string, userUid: number): Promise<any> {
    const cls = await this.mohClassModel.findOne({
      where: { name, user_uid: userUid },
    });
    if (!cls) throw new NotFoundException('MOH class not found');

    const entries = await this.mohEntryModel.findAll({
      where: { name: cls.name },
      order: [['position', 'ASC']],
    });

    return {
      ...cls.toJSON(),
      displayName: this.extractDisplayName(cls.name),
      entries: entries.map((e) => e.toJSON()),
    };
  }

  async create(
    data: { displayName: string; sort?: string; entries?: { filename: string; position: number }[] },
    userUid: number,
  ): Promise<any> {
    if (!data.displayName) {
      throw new BadRequestException('displayName is required');
    }

    const className = this.generateClassName(data.displayName, userUid);

    // Check for name collision
    const existing = await this.mohClassModel.findByPk(className);
    if (existing) {
      throw new BadRequestException(`MOH class "${data.displayName}" already exists`);
    }

    const directory = `${this.soundsBasePath}/${userUid}/`;

    // Create the MOH class
    const cls = await this.mohClassModel.create({
      name: className,
      mode: 'files',
      directory,
      sort: data.sort || 'random',
      user_uid: userUid,
    } as any);

    // Create entries
    const entries = (data.entries || []).map((e) => ({
      name: className,
      position: e.position,
      entry: `${this.soundsBasePath}/${e.filename}`,
    }));

    if (entries.length > 0) {
      await this.mohEntryModel.bulkCreate(entries as any[]);
    }

    // Reload MOH in Asterisk
    await this.reloadMoh();

    this.logger.log(`Created MOH class: ${className} with ${entries.length} entries`);

    return this.findOne(className, userUid);
  }

  async update(
    name: string,
    data: { displayName?: string; sort?: string; entries?: { filename: string; position: number }[] },
    userUid: number,
  ): Promise<any> {
    const cls = await this.mohClassModel.findOne({
      where: { name, user_uid: userUid },
    });
    if (!cls) throw new NotFoundException('MOH class not found');

    // Update class parameters
    if (data.sort) {
      await cls.update({ sort: data.sort });
    }

    // Atomically replace entries: delete all old → insert new
    if (data.entries !== undefined) {
      await this.mohEntryModel.destroy({ where: { name } });

      const entries = data.entries.map((e) => ({
        name,
        position: e.position,
        entry: `${this.soundsBasePath}/${e.filename}`,
      }));

      if (entries.length > 0) {
        await this.mohEntryModel.bulkCreate(entries as any[]);
      }
    }

    // Reload MOH in Asterisk
    await this.reloadMoh();

    this.logger.log(`Updated MOH class: ${name}`);

    return this.findOne(name, userUid);
  }

  async remove(name: string, userUid: number): Promise<void> {
    const cls = await this.mohClassModel.findOne({
      where: { name, user_uid: userUid },
    });
    if (!cls) throw new NotFoundException('MOH class not found');

    // Delete entries first (cascade)
    await this.mohEntryModel.destroy({ where: { name } });
    // Delete the class
    await cls.destroy();

    // Reload MOH in Asterisk
    await this.reloadMoh();

    this.logger.log(`Deleted MOH class: ${name}`);
  }

  /**
   * Reload MOH module in Asterisk via AMI.
   */
  private async reloadMoh(): Promise<void> {
    try {
      if (this.amiService.isConnected()) {
        await this.amiService.command('moh reload');
        this.logger.log('AMI: moh reload sent');
      }
    } catch (err) {
      this.logger.warn(`AMI moh reload failed (non-critical): ${err}`);
    }
  }
}
