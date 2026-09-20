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
exports.CallCenterAccessListService = exports.CC_OPERATOR_USER_LEVELS = void 0;
/**
 * Resolves the call-center access list (numbers) for a user.
 *
 * Operators are users (OPERATOR / SUPERVISOR), not SIP endpoints.
 * An operator may have no extension until shift start.
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const user_model_1 = require("../users/user.model");
const number_list_model_1 = require("../numbers/number-list.model");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_access_list_util_1 = require("./callcenter-access-list.util");
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
exports.CC_OPERATOR_USER_LEVELS = [user_model_1.UserLevel.OPERATOR, user_model_1.UserLevel.SUPERVISOR];
let CallCenterAccessListService = class CallCenterAccessListService {
    userModel;
    numberListModel;
    stateService;
    constructor(userModel, numberListModel, stateService) {
        this.userModel = userModel;
        this.numberListModel = numberListModel;
        this.stateService = stateService;
    }
    async resolveScope(userUid, userId) {
        const user = await this.userModel.findOne({
            where: { uniqueid: userId, vpbx_user_uid: userUid },
            attributes: ['uniqueid', 'numbers_id'],
        });
        const row = user ?? await this.userModel.findOne({
            where: { uniqueid: userId },
            attributes: ['uniqueid', 'numbers_id', 'vpbx_user_uid'],
        });
        const numbersId = row?.getDataValue('numbers_id');
        if (!numbersId || numbersId <= 0) {
            return { operators: null, queues: null };
        }
        const list = await this.numberListModel.findOne({
            where: { id: numbersId },
            attributes: ['id', 'numbers', 'user_uid'],
        });
        if (!list) {
            return { operators: null, queues: null };
        }
        const raw = this.readNumbersBlob(list.getDataValue('numbers'));
        const queues = (0, callcenter_access_list_util_1.normalizeAccessTokenSet)(raw?.queues);
        let operators = null;
        if ((0, callcenter_access_list_util_1.hasOperatorUserIdsKey)(raw)) {
            const ids = (0, callcenter_access_list_util_1.parsePositiveIdList)(raw?.operatorUserIds);
            operators = (0, callcenter_access_list_util_1.isUnrestrictedAccessList)(ids) ? null : new Set(ids);
        }
        else {
            const legacy = (0, callcenter_access_list_util_1.normalizeAccessTokenSet)(raw?.operators);
            if ((0, callcenter_access_list_util_1.isUnrestrictedAccessList)(legacy)) {
                operators = null;
            }
            else {
                operators = await this.mapExtensToUserIds(userUid, legacy);
            }
        }
        return {
            operators,
            queues: (0, callcenter_access_list_util_1.isUnrestrictedAccessList)(queues) ? null : queues,
        };
    }
    isOperatorUserAllowed(scope, operatorUserId) {
        if (scope.operators == null)
            return true;
        return scope.operators.has(Number(operatorUserId));
    }
    isQueueAllowed(scope, queueName) {
        if (scope.queues == null)
            return true;
        return scope.queues.has((0, callcenter_access_list_util_1.normalizeAccessToken)(queueName));
    }
    /**
     * Users (operator / supervisor) the supervisor may add to their watchlist.
     * Extension is optional — assigned at shift start.
     */
    async listCandidateOperators(userUid, scope) {
        const users = await this.userModel.findAll({
            where: {
                vpbx_user_uid: userUid,
                level: { [sequelize_2.Op.in]: exports.CC_OPERATOR_USER_LEVELS },
            },
            attributes: ['uniqueid', 'name', 'login', 'exten', 'level', 'avatar'],
        });
        const liveByUser = new Map();
        if (this.stateService) {
            for (const agent of this.stateService.getAllAgents(userUid)) {
                if (!agent.userId)
                    continue;
                const exten = (0, callcenter_access_list_util_1.normalizeAccessToken)(agent.interface);
                const online = agent.status !== 'OFFLINE';
                liveByUser.set(agent.userId, {
                    interface: agent.interface,
                    exten,
                    online,
                });
            }
        }
        const out = [];
        for (const u of users) {
            const userId = Number(u.getDataValue('uniqueid') || 0);
            if (!userId)
                continue;
            if (!this.isOperatorUserAllowed(scope, userId))
                continue;
            const live = liveByUser.get(userId);
            const dirExten = (0, callcenter_access_list_util_1.normalizeAccessToken)(u.getDataValue('exten'))
                || this.numericLogin(u.getDataValue('login'));
            const name = String(u.getDataValue('name') || '').trim()
                || String(u.getDataValue('login') || '').trim()
                || String(userId);
            const avatarRaw = u.getDataValue('avatar');
            const avatar = typeof avatarRaw === 'string' && avatarRaw.trim() ? avatarRaw.trim() : null;
            out.push({
                userId,
                name,
                exten: live?.exten || dirExten || '',
                interface: live?.interface || '',
                online: Boolean(live?.online),
                avatar,
            });
        }
        return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    serializeScope(scope) {
        return {
            operators: scope.operators ? [...scope.operators] : null,
            queues: scope.queues ? [...scope.queues] : null,
        };
    }
    normalizeExten(value) {
        return (0, callcenter_access_list_util_1.normalizeAccessToken)(value) || (0, endpoint_ids_util_1.interfaceToExtension)(value);
    }
    async mapWatchlistToUserIds(userUid, raw) {
        if (!Array.isArray(raw) || raw.length === 0)
            return [];
        const asIds = (0, callcenter_access_list_util_1.parsePositiveIdList)(raw);
        if (asIds.length === raw.length) {
            const users = await this.userModel.findAll({
                where: { uniqueid: { [sequelize_2.Op.in]: asIds }, vpbx_user_uid: userUid },
                attributes: ['uniqueid'],
            });
            const known = new Set(users.map((u) => Number(u.getDataValue('uniqueid'))));
            if (asIds.every((id) => known.has(id)))
                return asIds;
        }
        const tokens = (0, callcenter_access_list_util_1.normalizeAccessTokenSet)(raw);
        const mapped = await this.mapExtensToUserIds(userUid, tokens);
        return [...mapped];
    }
    async mapExtensToUserIds(userUid, tokens) {
        const ids = new Set();
        if (tokens.size === 0)
            return ids;
        const users = await this.userModel.findAll({
            where: { vpbx_user_uid: userUid, level: { [sequelize_2.Op.in]: exports.CC_OPERATOR_USER_LEVELS } },
            attributes: ['uniqueid', 'exten', 'login'],
        });
        for (const u of users) {
            const exten = (0, callcenter_access_list_util_1.normalizeAccessToken)(u.getDataValue('exten'))
                || this.numericLogin(u.getDataValue('login'));
            if (exten && tokens.has(exten))
                ids.add(Number(u.getDataValue('uniqueid')));
        }
        if (this.stateService) {
            for (const agent of this.stateService.getAllAgents(userUid)) {
                if (agent.userId > 0 && tokens.has((0, callcenter_access_list_util_1.normalizeAccessToken)(agent.interface))) {
                    ids.add(agent.userId);
                }
            }
        }
        return ids;
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
    numericLogin(login) {
        const s = String(login || '').trim();
        if (/^\d+$/.test(s))
            return s;
        return '';
    }
};
exports.CallCenterAccessListService = CallCenterAccessListService;
exports.CallCenterAccessListService = CallCenterAccessListService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(1, (0, sequelize_1.InjectModel)(number_list_model_1.NumberList)),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, Object, callcenter_state_service_1.CallCenterStateService])
], CallCenterAccessListService);
//# sourceMappingURL=callcenter-access-list.service.js.map