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
exports.ThreadVisibilityService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const user_model_1 = require("../users/user.model");
const number_list_model_1 = require("../numbers/number-list.model");
const callcenter_access_list_util_1 = require("../callcenter/callcenter-access-list.util");
const ai_chat_settings_service_1 = require("./ai-chat-settings.service");
const OWN_ONLY = { readableAuthors: null, allTenantThreads: false };
/**
 * Resolves which other authors' threads a caller may read.
 * Tenant-scoped user lookup only — no cross-tenant fallback.
 * Empty access list means nobody else's threads (unlike CDR).
 */
let ThreadVisibilityService = class ThreadVisibilityService {
    userModel;
    numberListModel;
    settings;
    constructor(userModel, numberListModel, settings) {
        this.userModel = userModel;
        this.numberListModel = numberListModel;
        this.settings = settings;
    }
    async resolve(tenantUid, userUid, role) {
        if (role === user_model_1.UserLevel.SUPERADMIN) {
            return OWN_ONLY;
        }
        if (role === user_model_1.UserLevel.ADMIN && (await this.settings.getSeeAllThreads(tenantUid))) {
            return { readableAuthors: null, allTenantThreads: true };
        }
        const user = await this.userModel.findOne({
            where: { uniqueid: userUid, vpbx_user_uid: tenantUid },
            attributes: ['uniqueid', 'numbers_id'],
        });
        const numbersId = this.readValue(user, 'numbers_id');
        if (!numbersId || numbersId <= 0) {
            return OWN_ONLY;
        }
        const list = await this.numberListModel.findOne({
            where: { id: numbersId, user_uid: tenantUid },
            attributes: ['id', 'numbers', 'user_uid'],
        });
        if (!list) {
            return OWN_ONLY;
        }
        const blob = this.readNumbersBlob(this.readValue(list, 'numbers'));
        const ids = (0, callcenter_access_list_util_1.parsePositiveIdList)(blob?.aiThreads?.userIds);
        const authors = ids.filter((id) => id !== userUid);
        if (authors.length === 0) {
            return OWN_ONLY;
        }
        return { readableAuthors: authors, allTenantThreads: false };
    }
    readValue(model, key) {
        if (!model)
            return undefined;
        if (typeof model.getDataValue === 'function') {
            return model.getDataValue(key);
        }
        return model[key];
    }
    readNumbersBlob(raw) {
        if (raw == null)
            return null;
        if (typeof raw === 'string') {
            try {
                return JSON.parse(raw);
            }
            catch {
                return null;
            }
        }
        if (typeof raw === 'object')
            return raw;
        return null;
    }
};
exports.ThreadVisibilityService = ThreadVisibilityService;
exports.ThreadVisibilityService = ThreadVisibilityService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(1, (0, sequelize_1.InjectModel)(number_list_model_1.NumberList)),
    __metadata("design:paramtypes", [Object, Object, ai_chat_settings_service_1.AiChatSettingsService])
], ThreadVisibilityService);
//# sourceMappingURL=thread-visibility.service.js.map