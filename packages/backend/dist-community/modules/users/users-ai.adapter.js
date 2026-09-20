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
var UsersAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersAiAdapter = exports.PORTAL_USER_FIELDS = void 0;
exports.toPortalUserView = toPortalUserView;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const user_model_1 = require("./user.model");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
/** Explicit allow list — never project an entity by subtracting known secrets (T-15-73). */
exports.PORTAL_USER_FIELDS = ['uid', 'name', 'role', 'last_activity'];
/**
 * UsersAiAdapter — read-only portal user tools (D-15, D-21, D-22).
 * Output is built from PORTAL_USER_FIELDS. Role changes are out of shape, not deferred.
 */
let UsersAiAdapter = UsersAiAdapter_1 = class UsersAiAdapter {
    usersService;
    registry;
    logger = new common_1.Logger(UsersAiAdapter_1.name);
    domain = 'users';
    constructor(usersService, registry) {
        this.usersService = usersService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('UsersAiAdapter registered');
    }
    getTools() {
        return [this.toolListPortalUsers(), this.toolDescribePortalUser()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Пользователи портала
- Пользователь портала — логин в веб-интерфейс, не SIP-абонент.
- Роли: SUPERADMIN, ADMIN, OPERATOR, SUPERVISOR, READONLY. Агент описывает, кто имеет доступ, и никогда не меняет роль.`;
    }
    async buildSummary(vpbxUserUid) {
        const rows = await this.usersService.findAll(vpbxUserUid);
        if (rows.length === 0)
            return '';
        const names = rows.map((row) => toPortalUserView(row).name).filter(Boolean);
        return `Пользователи портала: ${names.join(', ')}`;
    }
    toolListPortalUsers() {
        return {
            name: 'list_portal_users',
            description: 'Список пользователей портала тенанта: имя, роль, последняя активность. Без паролей и без изменения ролей.',
            inputSchema: {},
            entityType: 'user',
            handler: async (_args, uid) => {
                const rows = await this.usersService.findAll(uid);
                return { users: rows.map((row) => toPortalUserView(row)) };
            },
        };
    }
    toolDescribePortalUser() {
        return {
            name: 'describe_portal_user',
            description: 'Один пользователь портала: имя, роль, активность. Секреты и смена роли недоступны.',
            inputSchema: {
                uid: { type: 'number', description: 'UID пользователя портала' },
            },
            entityType: 'user',
            handler: async (args, uid) => {
                const found = await this.usersService.findById(Number(args.uid), uid);
                if (!found) {
                    return { error: 'User not found' };
                }
                return toPortalUserView(found);
            },
        };
    }
};
exports.UsersAiAdapter = UsersAiAdapter;
exports.UsersAiAdapter = UsersAiAdapter = UsersAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], UsersAiAdapter);
function toPortalUserView(user) {
    const last = user.last_activity ?? user.updatedAt ?? user.updated_at ?? null;
    return {
        uid: user.uniqueid ?? user.uid ?? null,
        name: user.name ?? '',
        role: roleName(user.level),
        last_activity: last instanceof Date ? last.toISOString() : last,
    };
}
function roleName(level) {
    if (typeof level === 'number' && user_model_1.UserLevel[level]) {
        return user_model_1.UserLevel[level];
    }
    return String(level ?? '');
}
//# sourceMappingURL=users-ai.adapter.js.map