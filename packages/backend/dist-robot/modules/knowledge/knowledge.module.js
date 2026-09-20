"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const product_access_core_module_1 = require("../product-access/product-access-core.module");
const integration_credentials_module_1 = require("../integration-credentials/integration-credentials.module");
const knowledge_models_1 = require("./knowledge.models");
const knowledge_service_1 = require("./knowledge.service");
const knowledge_jwt_controller_1 = require("./knowledge-jwt.controller");
let KnowledgeModule = class KnowledgeModule {
};
exports.KnowledgeModule = KnowledgeModule;
exports.KnowledgeModule = KnowledgeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            integration_credentials_module_1.IntegrationCredentialsModule,
            product_access_core_module_1.ProductAccessCoreModule,
            sequelize_1.SequelizeModule.forFeature([
                knowledge_models_1.KbBase, knowledge_models_1.KbDocument, knowledge_models_1.KbDocumentRevision, knowledge_models_1.KbChunk, knowledge_models_1.KbEmbeddingRevision,
                knowledge_models_1.KbRelease, knowledge_models_1.KbReleaseMember, knowledge_models_1.KbAccessBinding,
            ]),
        ],
        providers: [knowledge_service_1.KnowledgeService],
        controllers: [knowledge_jwt_controller_1.KnowledgeJwtController],
        exports: [knowledge_service_1.KnowledgeService, sequelize_1.SequelizeModule],
    })
], KnowledgeModule);
//# sourceMappingURL=knowledge.module.js.map