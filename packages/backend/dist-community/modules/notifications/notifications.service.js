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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const notification_integration_model_1 = require("./notification-integration.model");
const route_references_service_1 = require("../route-references/route-references.service");
const secret_cipher_util_1 = require("../ai-connectivity/secret-cipher.util");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    model;
    routeReferencesService;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(model, routeReferencesService) {
        this.model = model;
        this.routeReferencesService = routeReferencesService;
    }
    /** Strip encrypted_credentials before returning to HTTP clients. */
    toPublic(row) {
        const json = row.toJSON ? row.toJSON() : row;
        const { encrypted_credentials, ...rest } = json;
        return rest;
    }
    async findAll(vpbx) {
        const rows = await this.model.findAll({
            where: { user_uid: vpbx },
            order: [['uid', 'DESC']],
        });
        return rows.map((r) => this.toPublic(r));
    }
    async findOne(uid, vpbx) {
        const row = await this.model.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!row)
            throw new common_1.NotFoundException('Notification integration not found');
        return this.toPublic(row);
    }
    async create(dto, vpbx) {
        const { credentials, ...rest } = dto;
        delete rest.user_uid;
        const encrypted_credentials = credentials !== undefined
            ? (0, secret_cipher_util_1.encryptSecret)(JSON.stringify(credentials))
            : null;
        const row = await this.model.create({
            ...rest,
            encrypted_credentials,
            user_uid: vpbx,
        });
        return this.toPublic(row);
    }
    async update(uid, dto, vpbx) {
        const row = await this.model.findOne({ where: { uid, user_uid: vpbx } });
        if (!row)
            throw new common_1.NotFoundException('Notification integration not found');
        const { credentials, ...rest } = dto;
        delete rest.user_uid;
        const patch = { ...rest };
        if (credentials !== undefined) {
            patch.encrypted_credentials = credentials
                ? (0, secret_cipher_util_1.encryptSecret)(JSON.stringify(credentials))
                : null;
        }
        await row.update(patch);
        return this.toPublic(row);
    }
    async remove(uid, vpbx) {
        const row = await this.model.findOne({ where: { uid, user_uid: vpbx } });
        if (!row)
            throw new common_1.NotFoundException('Notification integration not found');
        await this.routeReferencesService.assertNotReferenced('integration', uid, vpbx, 'Notification integration is referenced and cannot be deleted');
        await row.destroy();
        return { success: true };
    }
    /**
     * Internal lookup for the dispatcher — decrypts credentials.
     *
     * No tenant filter: integration uid is globally unique and the dispatcher
     * resolves it from a route already scoped to the tenant.
     */
    async findByUidInternal(uid) {
        const row = await this.model.findOne({ where: { uid } });
        if (!row)
            throw new common_1.NotFoundException('Notification integration not found');
        const json = row.toJSON();
        let credentials = {};
        if (json.encrypted_credentials) {
            const plain = (0, secret_cipher_util_1.decryptSecret)(json.encrypted_credentials);
            if (plain) {
                credentials = JSON.parse(plain);
            }
        }
        return { ...json, credentials };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(notification_integration_model_1.NotificationIntegration)),
    __metadata("design:paramtypes", [Object, route_references_service_1.RouteReferencesService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map