"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaAssetsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const media_asset_models_1 = require("./media-asset.models");
/** Storage/probe contracts. Public analysis HTTP remains AI-04. Not imported by AppModule. */
let MediaAssetsModule = class MediaAssetsModule {
};
exports.MediaAssetsModule = MediaAssetsModule;
exports.MediaAssetsModule = MediaAssetsModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([media_asset_models_1.AiMediaAsset, media_asset_models_1.AiUpload])],
        exports: [sequelize_1.SequelizeModule],
    })
], MediaAssetsModule);
//# sourceMappingURL=media-assets.module.js.map