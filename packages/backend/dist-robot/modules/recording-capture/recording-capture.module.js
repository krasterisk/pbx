"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingCaptureModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const capture_models_1 = require("./capture.models");
/** Capture contracts. Does not import AppModule or charge wallets. */
let RecordingCaptureModule = class RecordingCaptureModule {
};
exports.RecordingCaptureModule = RecordingCaptureModule;
exports.RecordingCaptureModule = RecordingCaptureModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([
                capture_models_1.AiCaptureNodeBinding, capture_models_1.AiCaptureIntent, capture_models_1.AiCaptureSegment, capture_models_1.AiCaptureReceipt,
            ])],
        exports: [sequelize_1.SequelizeModule],
    })
], RecordingCaptureModule);
//# sourceMappingURL=recording-capture.module.js.map