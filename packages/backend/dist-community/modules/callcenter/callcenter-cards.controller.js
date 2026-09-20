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
exports.CallCenterCardsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const callcenter_cards_service_1 = require("./callcenter-cards.service");
const callcenter_cards_dto_1 = require("./dto/callcenter-cards.dto");
const callcenter_rbac_util_1 = require("./callcenter-rbac.util");
let CallCenterCardsController = class CallCenterCardsController {
    cardsService;
    constructor(cardsService) {
        this.cardsService = cardsService;
    }
    getCardTemplates(req) {
        return this.cardsService.findTemplates(req.user.vpbx_user_uid);
    }
    getCardTemplate(id, req) {
        return this.cardsService.findTemplate(id, req.user.vpbx_user_uid);
    }
    createCardTemplate(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.cardsService.createTemplate(dto, req.user.vpbx_user_uid);
    }
    updateCardTemplate(id, dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.cardsService.updateTemplate(id, dto, req.user.vpbx_user_uid);
    }
    removeCardTemplate(id, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.cardsService.removeTemplate(id, req.user.vpbx_user_uid);
    }
    getCards(callUniqueid, callerId, status, req) {
        return this.cardsService.findCards(req.user.vpbx_user_uid, {
            call_uniqueid: callUniqueid,
            caller_id: callerId,
            status,
        });
    }
    getCardByCall(uniqueid, req) {
        return this.cardsService.findCardByCall(uniqueid, req.user.vpbx_user_uid);
    }
    getCard(id, req) {
        return this.cardsService.findCard(id, req.user.vpbx_user_uid);
    }
    saveCard(dto, req) {
        return this.cardsService.saveCard(dto, req.user.vpbx_user_uid, req.user.sub);
    }
    updateCard(id, dto, req) {
        return this.cardsService.updateCard(id, dto, req.user.vpbx_user_uid);
    }
};
exports.CallCenterCardsController = CallCenterCardsController;
__decorate([
    (0, common_1.Get)('card-templates'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "getCardTemplates", null);
__decorate([
    (0, common_1.Get)('card-templates/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "getCardTemplate", null);
__decorate([
    (0, common_1.Post)('card-templates'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_cards_dto_1.CreateCardTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "createCardTemplate", null);
__decorate([
    (0, common_1.Put)('card-templates/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_cards_dto_1.UpdateCardTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "updateCardTemplate", null);
__decorate([
    (0, common_1.Delete)('card-templates/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "removeCardTemplate", null);
__decorate([
    (0, common_1.Get)('cards'),
    __param(0, (0, common_1.Query)('call_uniqueid')),
    __param(1, (0, common_1.Query)('caller_id')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "getCards", null);
__decorate([
    (0, common_1.Get)('cards/by-call/:uniqueid'),
    __param(0, (0, common_1.Param)('uniqueid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "getCardByCall", null);
__decorate([
    (0, common_1.Get)('cards/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "getCard", null);
__decorate([
    (0, common_1.Post)('cards'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [callcenter_cards_dto_1.SaveCardDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "saveCard", null);
__decorate([
    (0, common_1.Put)('cards/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, callcenter_cards_dto_1.UpdateCardDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterCardsController.prototype, "updateCard", null);
exports.CallCenterCardsController = CallCenterCardsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter'),
    __metadata("design:paramtypes", [callcenter_cards_service_1.CallCenterCardsService])
], CallCenterCardsController);
//# sourceMappingURL=callcenter-cards.controller.js.map