"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const user_model_1 = require("./user.model");
const system_settings_service_1 = require("../system-settings/system-settings.service");
const bcrypt = __importStar(require("bcrypt"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const sequelize_2 = require("sequelize");
const users_avatar_util_1 = require("./users-avatar.util");
let UsersService = class UsersService {
    userModel;
    systemSettings;
    constructor(userModel, systemSettings) {
        this.userModel = userModel;
        this.systemSettings = systemSettings;
    }
    async findByLogin(login) {
        // MySQL's deployed collation resolves ASCII case-insensitively. Use the
        // same login/duplicate-account rule on PostgreSQL instead of depending on
        // each database's default collation.
        return this.userModel.findOne({ where: (0, sequelize_2.where)((0, sequelize_2.fn)('LOWER', (0, sequelize_2.col)('login')), login.toLowerCase()) });
    }
    async findById(id, vpbxUserUid) {
        const whereClause = { uniqueid: id };
        if (vpbxUserUid !== undefined) {
            whereClause.vpbx_user_uid = vpbxUserUid;
        }
        return this.userModel.findOne({
            where: whereClause,
            attributes: { exclude: ['passwd'] },
        });
    }
    async findAll(vpbxUserUid) {
        return this.userModel.findAll({
            where: { vpbx_user_uid: vpbxUserUid },
            attributes: { exclude: ['passwd'] },
            order: [['name', 'ASC']],
        });
    }
    async create(data) {
        let finalPasswd;
        if (data.passwd) {
            finalPasswd = data.passwd;
        }
        else if (data.password) {
            finalPasswd = await bcrypt.hash(data.password, 12);
        }
        else {
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
    async update(id, vpbxUserUid, data) {
        const updateData = { ...data };
        const newPassword = data.password || data.passwd;
        if (newPassword) {
            const isBcrypt = newPassword.startsWith('$2b$') || newPassword.startsWith('$2a$');
            updateData.passwd = isBcrypt
                ? newPassword
                : await bcrypt.hash(newPassword, 12);
            delete updateData.password;
        }
        else {
            delete updateData.passwd;
            delete updateData.password;
        }
        await this.userModel.update(updateData, { where: { uniqueid: id, vpbx_user_uid: vpbxUserUid } });
        return this.findById(id, vpbxUserUid);
    }
    async delete(id, vpbxUserUid) {
        await this.userModel.destroy({ where: { uniqueid: id, vpbx_user_uid: vpbxUserUid } });
    }
    async bulkRemove(ids, vpbxUserUid) {
        const deleted = await this.userModel.destroy({
            where: { uniqueid: ids, vpbx_user_uid: vpbxUserUid },
        });
        return { deleted };
    }
    /** Admin (or platform) may edit any tenant user; others only themselves. */
    assertCanManageAvatar(actor, targetUserId) {
        const isAdmin = actor.level === user_model_1.UserLevel.ADMIN ||
            actor.level === user_model_1.UserLevel.SUPERADMIN;
        if (!isAdmin && actor.sub !== targetUserId) {
            throw new common_1.ForbiddenException('Cannot change another user avatar');
        }
    }
    async getAvatarsDir(vpbxUserUid) {
        const cfg = await this.systemSettings.getServerConfigRaw();
        const base = cfg.records_base_path || '/usr/records';
        return path.resolve(base, String(vpbxUserUid), 'avatars');
    }
    async saveAvatar(targetUserId, vpbxUserUid, file) {
        const user = await this.findById(targetUserId, vpbxUserUid);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const ext = (0, users_avatar_util_1.avatarExtFromMime)(file.mimetype);
        if (!ext) {
            throw new common_1.BadRequestException('Unsupported image type');
        }
        const dir = await this.getAvatarsDir(vpbxUserUid);
        await fs.mkdir(dir, { recursive: true });
        const filename = `u${targetUserId}_${Date.now()}${ext}`;
        const dest = (0, users_avatar_util_1.resolveUnderDir)(dir, filename);
        if (!dest) {
            throw new common_1.BadRequestException('Invalid avatar path');
        }
        if (user.avatar) {
            await this.unlinkAvatarFile(vpbxUserUid, user.avatar);
        }
        await fs.writeFile(dest, file.buffer);
        await this.userModel.update({ avatar: filename }, { where: { uniqueid: targetUserId, vpbx_user_uid: vpbxUserUid } });
        const updated = await this.findById(targetUserId, vpbxUserUid);
        if (!updated) {
            throw new common_1.NotFoundException('User not found');
        }
        return updated;
    }
    async removeAvatar(targetUserId, vpbxUserUid) {
        const user = await this.findById(targetUserId, vpbxUserUid);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.avatar) {
            await this.unlinkAvatarFile(vpbxUserUid, user.avatar);
        }
        await this.userModel.update({ avatar: null }, { where: { uniqueid: targetUserId, vpbx_user_uid: vpbxUserUid } });
        const updated = await this.findById(targetUserId, vpbxUserUid);
        if (!updated) {
            throw new common_1.NotFoundException('User not found');
        }
        return updated;
    }
    async openAvatarStream(targetUserId, vpbxUserUid) {
        const user = await this.findById(targetUserId, vpbxUserUid);
        if (!user?.avatar) {
            throw new common_1.NotFoundException('Avatar not found');
        }
        const safe = (0, users_avatar_util_1.sanitizeAvatarFilename)(user.avatar);
        if (!safe) {
            throw new common_1.NotFoundException('Avatar not found');
        }
        const dir = await this.getAvatarsDir(vpbxUserUid);
        const absolutePath = (0, users_avatar_util_1.resolveUnderDir)(dir, safe);
        if (!absolutePath) {
            throw new common_1.NotFoundException('Avatar not found');
        }
        try {
            await fs.access(absolutePath);
        }
        catch {
            throw new common_1.NotFoundException('Avatar not found');
        }
        return { absolutePath, contentType: (0, users_avatar_util_1.avatarContentType)(absolutePath) };
    }
    async unlinkAvatarFile(vpbxUserUid, filename) {
        const safe = (0, users_avatar_util_1.sanitizeAvatarFilename)(filename);
        if (!safe)
            return;
        const dir = await this.getAvatarsDir(vpbxUserUid);
        const absolutePath = (0, users_avatar_util_1.resolveUnderDir)(dir, safe);
        if (!absolutePath)
            return;
        try {
            await fs.unlink(absolutePath);
        }
        catch {
            // ignore missing file
        }
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [Object, system_settings_service_1.SystemSettingsService])
], UsersService);
//# sourceMappingURL=users.service.js.map