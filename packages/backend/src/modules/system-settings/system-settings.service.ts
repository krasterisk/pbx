import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SystemSetting } from './system-setting.model';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectModel(SystemSetting) private settingModel: typeof SystemSetting,
  ) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.settingModel.findAll();
  }
}
