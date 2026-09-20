"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityPbxModule = exports.COMMUNITY_PBX_COMPONENTS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const path = __importStar(require("path"));
const pbx_core_composition_1 = require("./pbx-core.composition");
const provider_key_secret_1 = require("./provider-key-secret");
exports.COMMUNITY_PBX_COMPONENTS = Object.freeze([
    'pbx-core', 'tenant-identity', 'ai-connectivity', 'integration-credentials',
]);
let CommunityPbxCompositionController = class CommunityPbxCompositionController {
    describe() {
        return {
            status: 'ok',
            profile: 'community-pbx',
            commercialProductSource: 'absent',
            productRuntime: 'community-core',
        };
    }
};
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommunityPbxCompositionController.prototype, "describe", null);
CommunityPbxCompositionController = __decorate([
    (0, common_1.Controller)('composition')
], CommunityPbxCompositionController);
/** Compile-time community PBX: existing core without commercial AI product modules. */
let CommunityPbxModule = class CommunityPbxModule {
    constructor() {
        (0, provider_key_secret_1.assertProviderKeySecret)();
    }
};
exports.CommunityPbxModule = CommunityPbxModule;
exports.CommunityPbxModule = CommunityPbxModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: path.resolve(__dirname, '../../../../.env'),
                ignoreEnvFile: process.env.CI === 'true' && process.env.DB_CORE_TEST_PROFILE === 'true',
            }),
            ...(0, pbx_core_composition_1.createPbxRuntimeImports)(pbx_core_composition_1.PBX_CORE_MODELS),
        ],
        controllers: [CommunityPbxCompositionController],
        providers: [pbx_core_composition_1.PBX_THROTTLER_PROVIDER],
    }),
    __metadata("design:paramtypes", [])
], CommunityPbxModule);
//# sourceMappingURL=community-pbx.module.js.map