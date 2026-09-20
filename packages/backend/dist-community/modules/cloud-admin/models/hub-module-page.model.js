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
exports.HubModulePage = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const hub_module_model_1 = require("./hub-module.model");
let HubModulePage = class HubModulePage extends sequelize_typescript_1.Model {
};
exports.HubModulePage = HubModulePage;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], HubModulePage.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.ForeignKey)(() => hub_module_model_1.HubModule),
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], HubModulePage.prototype, "hub_code", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], HubModulePage.prototype, "page_code", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(255)),
    __metadata("design:type", Object)
], HubModulePage.prototype, "path", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], HubModulePage.prototype, "sort_order", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => hub_module_model_1.HubModule, { foreignKey: 'hub_code', targetKey: 'code', as: 'hubModule' }),
    __metadata("design:type", hub_module_model_1.HubModule)
], HubModulePage.prototype, "hubModule", void 0);
exports.HubModulePage = HubModulePage = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'hub_module_pages',
        timestamps: false,
        indexes: [
            { unique: true, fields: ['hub_code', 'page_code'], name: 'uq_hub_module_page' },
            { fields: ['hub_code'], name: 'idx_hub_module_pages_hub' },
        ],
    })
], HubModulePage);
//# sourceMappingURL=hub-module-page.model.js.map