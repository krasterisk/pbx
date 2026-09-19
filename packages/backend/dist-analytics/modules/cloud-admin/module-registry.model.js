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
exports.ModuleRegistry = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
let ModuleRegistry = class ModuleRegistry extends sequelize_typescript_1.Model {
};
exports.ModuleRegistry = ModuleRegistry;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.INTEGER),
    __metadata("design:type", Number)
], ModuleRegistry.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Unique,
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(64)),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "code", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(128)),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.AllowNull)(true),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", Object)
], ModuleRegistry.prototype, "description", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('1.0.0'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.STRING(16)),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "version", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('pbx'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.ENUM('pbx', 'calls', 'analytics', 'integrations', 'admin')),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "category", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ModuleRegistry.prototype, "is_core", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ModuleRegistry.prototype, "is_paid", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(0),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DECIMAL(10, 2)),
    __metadata("design:type", Number)
], ModuleRegistry.prototype, "price_monthly", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(true),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ModuleRegistry.prototype, "is_published", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(false),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ModuleRegistry.prototype, "requires_cloud", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)('[]'),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.JSON),
    __metadata("design:type", Array)
], ModuleRegistry.prototype, "dependencies", void 0);
__decorate([
    (0, sequelize_typescript_1.Default)(sequelize_typescript_1.DataType.NOW),
    (0, sequelize_typescript_1.Column)(sequelize_typescript_1.DataType.DATE),
    __metadata("design:type", Date)
], ModuleRegistry.prototype, "created_at", void 0);
exports.ModuleRegistry = ModuleRegistry = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'modules_registry', timestamps: false, createdAt: 'created_at', updatedAt: false })
], ModuleRegistry);
//# sourceMappingURL=module-registry.model.js.map