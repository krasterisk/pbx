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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextIncludesService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const context_include_model_1 = require("./context-include.model");
const context_model_1 = require("../contexts/context.model");
let ContextIncludesService = class ContextIncludesService {
    ciModel;
    contextModel;
    constructor(ciModel, contextModel) {
        this.ciModel = ciModel;
        this.contextModel = contextModel;
    }
    /** Get all includes for a context */
    async findByContext(contextUid, vpbxUserUid) {
        const includes = await this.ciModel.findAll({
            where: { context_uid: contextUid, user_uid: vpbxUserUid },
            order: [['priority', 'ASC']],
        });
        // Enrich with context names
        const includeUids = includes.map((i) => i.include_uid);
        if (includeUids.length === 0)
            return [];
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
    async add(contextUid, includeUid, vpbxUserUid) {
        // prevent circular reference
        if (contextUid === includeUid) {
            throw new Error('A context cannot include itself');
        }
        // Get max priority
        const maxPriority = await this.ciModel.max('priority', {
            where: { context_uid: contextUid, user_uid: vpbxUserUid },
        });
        return this.ciModel.create({
            context_uid: contextUid,
            include_uid: includeUid,
            priority: (maxPriority || 0) + 1,
            user_uid: vpbxUserUid,
        });
    }
    /** Remove an include */
    async remove(uid, vpbxUserUid) {
        const inc = await this.ciModel.findOne({ where: { uid, user_uid: vpbxUserUid } });
        if (!inc)
            throw new common_1.NotFoundException('Include not found');
        await inc.destroy();
    }
    /** Get context names for includes (used in dialplan generation) */
    async getIncludeNames(contextUid, vpbxUserUid) {
        const includes = await this.findByContext(contextUid, vpbxUserUid);
        return includes.map((i) => i.include_name);
    }
};
exports.ContextIncludesService = ContextIncludesService;
exports.ContextIncludesService = ContextIncludesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(context_include_model_1.ContextInclude)),
    __param(1, (0, sequelize_1.InjectModel)(context_model_1.Context)),
    __metadata("design:paramtypes", [Object, Object])
], ContextIncludesService);
//# sourceMappingURL=context-includes.service.js.map