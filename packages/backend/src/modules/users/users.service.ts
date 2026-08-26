import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User, UserLevel } from './user.model';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  sanitizeAvatarFilename,
  avatarContentType,
  avatarExtFromMime,
  resolveUnderDir,
} from './users-avatar.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  async findByLogin(login: string): Promise<User | null> {
    return this.userModel.findOne({ where: { login } });
  }

  async findById(id: number, vpbxUserUid?: number): Promise<User | null> {
    const whereClause: any = { uniqueid: id };
    if (vpbxUserUid) {
      whereClause.vpbx_user_uid = vpbxUserUid;
    }
    return this.userModel.findOne({
      where: whereClause,
      attributes: { exclude: ['passwd'] },
    });
  }

  async findAll(vpbxUserUid: number): Promise<User[]> {
    return this.userModel.findAll({
      where: { vpbx_user_uid: vpbxUserUid },
      attributes: { exclude: ['passwd'] },
      order: [['name', 'ASC']],
    });
  }

  async create(data: {
    login: string;
    name: string;
    /** Plain-text password — will be MD5-hashed (legacy path, prefer passwd) */
    password?: string;
    /** Already-hashed password (bcrypt or MD5) — stored as-is */
    passwd?: string;
    email?: string;
    level?: number;
    role?: number;
    exten?: string;
    vpbx_user_uid?: number;
  }): Promise<User> {
    let finalPasswd: string;

    if (data.passwd) {
      finalPasswd = data.passwd;
    } else if (data.password) {
      finalPasswd = crypto.createHash('md5').update(data.password).digest('hex');
    } else {
      finalPasswd = '';
    }

    return this.userModel.create({
      login: data.login,
      name: data.name,
      passwd: finalPasswd,
      email: data.email || '',
      level: data.level ?? 2,
      role: data.role ?? 0,
      exten: data.exten || '',
      vpbx_user_uid: data.vpbx_user_uid ?? 0,
    });
  }

  async update(id: number, vpbxUserUid: number, data: Partial<{
    login: string;
    name: string;
    password?: string;
    passwd?: string;
    email: string;
    level: number;
    role: number;
    exten: string;
    permit_extens: string;
    numbers_id: number;
    listbook_edit: number;
    oper_chanspy: number;
    outbound_posttime: number;
    suspension_time: number;
    inactive_time: number;
    vpbx_user_uid: number;
    avatar: string | null;
  }>): Promise<User | null> {
    const updateData: any = { ...data };

    const newPassword = data.password || data.passwd;

    if (newPassword) {
      const isBcrypt = newPassword.startsWith('$2b$') || newPassword.startsWith('$2a$');
      updateData.passwd = isBcrypt
        ? newPassword
        : crypto.createHash('md5').update(newPassword).digest('hex');
      delete updateData.password;
    } else {
      delete updateData.passwd;
      delete updateData.password;
    }

    await this.userModel.update(updateData, { where: { uniqueid: id, vpbx_user_uid: vpbxUserUid } });
    return this.findById(id, vpbxUserUid);
  }

  async delete(id: number, vpbxUserUid: number): Promise<void> {
    await this.userModel.destroy({ where: { uniqueid: id, vpbx_user_uid: vpbxUserUid } });
  }

  async bulkRemove(ids: number[], vpbxUserUid: number): Promise<{ deleted: number }> {
    const deleted = await this.userModel.destroy({
      where: { uniqueid: ids, vpbx_user_uid: vpbxUserUid },
    });
    return { deleted };
  }

  /** Admin (or platform) may edit any tenant user; others only themselves. */
  assertCanManageAvatar(actor: { sub: number; level: number }, targetUserId: number): void {
    const isAdmin =
      actor.level === UserLevel.ADMIN ||
      actor.level === UserLevel.SUPERADMIN;
    if (!isAdmin && actor.sub !== targetUserId) {
      throw new ForbiddenException('Cannot change another user avatar');
    }
  }

  private async getAvatarsDir(vpbxUserUid: number): Promise<string> {
    const cfg = await this.systemSettings.getServerConfigRaw();
    const base = cfg.records_base_path || '/usr/records';
    return path.resolve(base, String(vpbxUserUid), 'avatars');
  }

  async saveAvatar(
    targetUserId: number,
    vpbxUserUid: number,
    file: Express.Multer.File,
  ): Promise<User> {
    const user = await this.findById(targetUserId, vpbxUserUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ext = avatarExtFromMime(file.mimetype);
    if (!ext) {
      throw new BadRequestException('Unsupported image type');
    }

    const dir = await this.getAvatarsDir(vpbxUserUid);
    await fs.mkdir(dir, { recursive: true });

    const filename = `u${targetUserId}_${Date.now()}${ext}`;
    const dest = resolveUnderDir(dir, filename);
    if (!dest) {
      throw new BadRequestException('Invalid avatar path');
    }

    if (user.avatar) {
      await this.unlinkAvatarFile(vpbxUserUid, user.avatar);
    }

    await fs.writeFile(dest, file.buffer);
    await this.userModel.update(
      { avatar: filename },
      { where: { uniqueid: targetUserId, vpbx_user_uid: vpbxUserUid } },
    );

    const updated = await this.findById(targetUserId, vpbxUserUid);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  async removeAvatar(targetUserId: number, vpbxUserUid: number): Promise<User> {
    const user = await this.findById(targetUserId, vpbxUserUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.avatar) {
      await this.unlinkAvatarFile(vpbxUserUid, user.avatar);
    }
    await this.userModel.update(
      { avatar: null },
      { where: { uniqueid: targetUserId, vpbx_user_uid: vpbxUserUid } },
    );
    const updated = await this.findById(targetUserId, vpbxUserUid);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  async openAvatarStream(
    targetUserId: number,
    vpbxUserUid: number,
  ): Promise<{ absolutePath: string; contentType: string }> {
    const user = await this.findById(targetUserId, vpbxUserUid);
    if (!user?.avatar) {
      throw new NotFoundException('Avatar not found');
    }
    const safe = sanitizeAvatarFilename(user.avatar);
    if (!safe) {
      throw new NotFoundException('Avatar not found');
    }
    const dir = await this.getAvatarsDir(vpbxUserUid);
    const absolutePath = resolveUnderDir(dir, safe);
    if (!absolutePath) {
      throw new NotFoundException('Avatar not found');
    }
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('Avatar not found');
    }
    return { absolutePath, contentType: avatarContentType(absolutePath) };
  }

  private async unlinkAvatarFile(vpbxUserUid: number, filename: string): Promise<void> {
    const safe = sanitizeAvatarFilename(filename);
    if (!safe) return;
    const dir = await this.getAvatarsDir(vpbxUserUid);
    const absolutePath = resolveUnderDir(dir, safe);
    if (!absolutePath) return;
    try {
      await fs.unlink(absolutePath);
    } catch {
      // ignore missing file
    }
  }
}
