"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MohService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MohService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const moh_class_model_1 = require("./moh-class.model");
const moh_entry_model_1 = require("./moh-entry.model");
const ami_service_1 = require("../ami/ami.service");
const config_1 = require("@nestjs/config");
let MohService = MohService_1 = class MohService {
    mohClassModel;
    mohEntryModel;
    amiService;
    configService;
    logger = new common_1.Logger(MohService_1.name);
    soundsBasePath;
    constructor(mohClassModel, mohEntryModel, amiService, configService) {
        this.mohClassModel = mohClassModel;
        this.mohEntryModel = mohEntryModel;
        this.amiService = amiService;
        this.configService = configService;
        this.soundsBasePath = this.configService.get('ASTERISK_SOUNDS_PATH', '/var/lib/asterisk/sounds/krasterisk');
    }
    /**
     * Generate a safe Asterisk MOH class name from a display name.
     * Format: moh_{userUid}_{slug}
     * Only [a-z0-9_], max 80 chars (Asterisk limit).
     */
    generateClassName(displayName, userUid) {
        const slug = displayName
            .toLowerCase()
            .replace(/[^a-z0-9а-яё]/gi, '_')
            // transliterate basic Cyrillic
            .replace(/[а-яё]/g, (c) => {
            const map = {
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
    extractDisplayName(className) {
        const parts = className.split('_');
        // Remove "moh" and user_uid prefix
        if (parts.length >= 3 && parts[0] === 'moh') {
            return parts.slice(2).join('_');
        }
        return className;
    }
    async findAll(userUid) {
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
    async findOne(name, userUid) {
        const cls = await this.mohClassModel.findOne({
            where: { name, user_uid: userUid },
        });
        if (!cls)
            throw new common_1.NotFoundException('MOH class not found');
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
    async create(data, userUid) {
        if (!data.displayName) {
            throw new common_1.BadRequestException('displayName is required');
        }
        const className = this.generateClassName(data.displayName, userUid);
        // Check for name collision
        const existing = await this.mohClassModel.findByPk(className);
        if (existing) {
            throw new common_1.BadRequestException(`MOH class "${data.displayName}" already exists`);
        }
        const entryRows = data.entries || [];
        if (entryRows.length === 0) {
            throw new common_1.BadRequestException('At least one playlist entry is required');
        }
        // Create the MOH class (playlist mode — entries drive playback, not directory)
        const cls = await this.mohClassModel.create({
            name: className,
            mode: 'playlist',
            directory: null,
            sort: data.sort || 'random',
            user_uid: userUid,
        });
        // Create entries
        const entries = entryRows.map((e) => ({
            name: className,
            position: e.position,
            entry: `${this.soundsBasePath}/${e.filename}`,
        }));
        if (entries.length > 0) {
            await this.mohEntryModel.bulkCreate(entries);
        }
        // Reload MOH in Asterisk
        await this.reloadMoh();
        this.logger.log(`Created MOH class: ${className} with ${entries.length} entries`);
        return this.findOne(className, userUid);
    }
    async update(name, data, userUid) {
        const cls = await this.mohClassModel.findOne({
            where: { name, user_uid: userUid },
        });
        if (!cls)
            throw new common_1.NotFoundException('MOH class not found');
        // Update class parameters
        if (data.sort) {
            await cls.update({ sort: data.sort });
        }
        // Atomically replace entries: delete all old → insert new
        if (data.entries !== undefined) {
            if (data.entries.length === 0) {
                throw new common_1.BadRequestException('At least one playlist entry is required');
            }
            await this.mohEntryModel.destroy({ where: { name } });
            const entries = data.entries.map((e) => ({
                name,
                position: e.position,
                entry: `${this.soundsBasePath}/${e.filename}`,
            }));
            await this.mohEntryModel.bulkCreate(entries);
            if (cls.mode !== 'playlist') {
                await cls.update({ mode: 'playlist', directory: null });
            }
        }
        // Reload MOH in Asterisk
        await this.reloadMoh();
        this.logger.log(`Updated MOH class: ${name}`);
        return this.findOne(name, userUid);
    }
    async remove(name, userUid) {
        const cls = await this.mohClassModel.findOne({
            where: { name, user_uid: userUid },
        });
        if (!cls)
            throw new common_1.NotFoundException('MOH class not found');
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
    async reloadMoh() {
        try {
            if (this.amiService.isConnected()) {
                await this.amiService.command('moh reload');
                this.logger.log('AMI: moh reload sent');
            }
        }
        catch (err) {
            this.logger.warn(`AMI moh reload failed (non-critical): ${err}`);
        }
    }
};
exports.MohService = MohService;
exports.MohService = MohService = MohService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(moh_class_model_1.MohClass)),
    __param(1, (0, sequelize_1.InjectModel)(moh_entry_model_1.MohEntry)),
    __metadata("design:paramtypes", [Object, Object, ami_service_1.AmiService,
        config_1.ConfigService])
], MohService);
//# sourceMappingURL=moh.service.js.map