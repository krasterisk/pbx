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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubModule = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const hub_module_page_model_1 = require("./hub-module-page.model");
let HubModule = class HubModule extends sequelize_typescript_1.Model {
};
exports.HubModule = HubModule;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], HubModule.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Unique,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], HubModule.prototype, "code", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(128)),
    __metadata("design:type", String)
], HubModule.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Default)('base'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM('base', 'market')),
    __metadata("design:type", String)
], HubModule.prototype, "kind", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], HubModule.prototype, "sort_order", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], HubModule.prototype, "requires_cloud", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => hub_module_page_model_1.HubModulePage, { foreignKey: 'hub_code', sourceKey: 'code', as: 'pages' }),
    __metadata("design:type", Array)
], HubModule.prototype, "pages", void 0);
exports.HubModule = HubModule = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'hub_modules',
        timestamps: false,
        indexes: [
            { unique: true, fields: ['code'], name: 'uq_hub_modules_code' },
        ],
    })
], HubModule);
//# sourceMappingURL=hub-module.model.js.map