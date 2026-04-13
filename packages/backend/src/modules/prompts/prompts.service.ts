import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Prompt } from './prompt.model';
import { AmiService } from '../ami/ami.service';

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  constructor(
    @InjectModel(Prompt) private promptModel: typeof Prompt,
    private readonly amiService: AmiService,
  ) {}

  async findAll(userUid: number): Promise<Prompt[]> {
    return this.promptModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'DESC']],
    });
  }

  async findOne(uid: number, userUid: number): Promise<Prompt> {
    const prompt = await this.promptModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return prompt;
  }

  /**
   * Generate a unique, safe filename for Asterisk.
   * Only ASCII alphanumeric + underscore, no spaces or special chars.
   */
  generateFilename(userUid: number): string {
    const timestamp = Date.now();
    return `prompt_${userUid}_${timestamp}`;
  }

  async create(data: { filename: string; comment: string; moh?: string }, userUid: number): Promise<Prompt> {
    return this.promptModel.create({
      filename: data.filename,
      comment: data.comment || '',
      moh: data.moh || '',
      user_uid: userUid,
    } as any);
  }

  async update(uid: number, data: Partial<{ comment: string; moh: string }>, userUid: number): Promise<Prompt> {
    const prompt = await this.findOne(uid, userUid);
    await prompt.update(data);
    return prompt;
  }

  async remove(uid: number, userUid: number): Promise<{ filename: string; moh: string }> {
    const prompt = await this.findOne(uid, userUid);
    const { filename, moh } = prompt;
    await prompt.destroy();
    return { filename, moh };
  }

  /**
   * Initiate a recording via AMI Originate — calls the user's extension,
   * and the Asterisk record_dial context handles the recording.
   */
  async recordByPhone(
    exten: string,
    filename: string,
    userUid: number,
  ): Promise<void> {
    try {
      await this.amiService.action({
        action: 'Originate',
        channel: exten,
        callerid: 'Record',
        context: 'record_dial',
        exten: 'start',
        priority: '1',
        variable: `FILENAME=${filename},VPBX_UID=${userUid}`,
        async: 'true',
      });
      this.logger.log(`Recording initiated: exten=${exten}, file=${filename}`);
    } catch (err) {
      this.logger.error(`Failed to originate recording: ${err}`);
      throw new BadRequestException('Failed to initiate recording call');
    }
  }

  async bulkRemove(uids: number[], userUid: number): Promise<{ deleted: number }> {
    const deleted = await this.promptModel.destroy({
      where: { uid: uids, user_uid: userUid },
    });
    return { deleted };
  }
}
