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
exports.UpdateCardDto = exports.SaveCardDto = exports.UpdateCardTemplateDto = exports.CreateCardTemplateDto = exports.CardFieldDto = exports.CARD_STATUS_VALUES = exports.CARD_AUTO_OPEN_VALUES = exports.CARD_FIELD_TYPES = void 0;
/**
 * Call card template / data DTOs with class-validator.
 */
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
/** v1 field types (14) — 'file' excluded per D-11. */
exports.CARD_FIELD_TYPES = [
    'text',
    'textarea',
    'phone',
    'email',
    'select',
    'multi_select',
    'date',
    'datetime',
    'number',
    'checkbox',
    'phonebook_lookup',
    'divider',
    'heading',
    'readonly',
];
exports.CARD_AUTO_OPEN_VALUES = ['answer', 'ring', 'manual'];
exports.CARD_STATUS_VALUES = ['draft', 'saved', 'missed', 'callback_done'];
class CardFieldDto {
    field_key;
    field_type;
    label;
    placeholder;
    is_required;
    default_value;
    options;
    depends_on;
    depends_values;
    sort_order;
    width;
    auto_populate;
}
exports.CardFieldDto = CardFieldDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CardFieldDto.prototype, "field_key", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...exports.CARD_FIELD_TYPES]),
    __metadata("design:type", String)
], CardFieldDto.prototype, "field_type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CardFieldDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], CardFieldDto.prototype, "placeholder", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CardFieldDto.prototype, "is_required", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], CardFieldDto.prototype, "default_value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CardFieldDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CardFieldDto.prototype, "depends_on", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CardFieldDto.prototype, "depends_values", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CardFieldDto.prototype, "sort_order", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['full', 'half']),
    __metadata("design:type", String)
], CardFieldDto.prototype, "width", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CardFieldDto.prototype, "auto_populate", void 0);
class CreateCardTemplateDto {
    name;
    description;
    is_active;
    auto_open_on;
    auto_save_on_timeout;
    webhook_integration_uid;
    webhook_field_map;
    queue_names;
    fields;
}
exports.CreateCardTemplateDto = CreateCardTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CreateCardTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCardTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCardTemplateDto.prototype, "is_active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...exports.CARD_AUTO_OPEN_VALUES]),
    __metadata("design:type", String)
], CreateCardTemplateDto.prototype, "auto_open_on", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCardTemplateDto.prototype, "auto_save_on_timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateCardTemplateDto.prototype, "webhook_integration_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateCardTemplateDto.prototype, "webhook_field_map", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateCardTemplateDto.prototype, "queue_names", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CardFieldDto),
    __metadata("design:type", Array)
], CreateCardTemplateDto.prototype, "fields", void 0);
class UpdateCardTemplateDto {
    name;
    description;
    is_active;
    auto_open_on;
    auto_save_on_timeout;
    webhook_integration_uid;
    webhook_field_map;
    queue_names;
    fields;
}
exports.UpdateCardTemplateDto = UpdateCardTemplateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], UpdateCardTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCardTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCardTemplateDto.prototype, "is_active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...exports.CARD_AUTO_OPEN_VALUES]),
    __metadata("design:type", String)
], UpdateCardTemplateDto.prototype, "auto_open_on", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCardTemplateDto.prototype, "auto_save_on_timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], UpdateCardTemplateDto.prototype, "webhook_integration_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateCardTemplateDto.prototype, "webhook_field_map", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateCardTemplateDto.prototype, "queue_names", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CardFieldDto),
    __metadata("design:type", Array)
], UpdateCardTemplateDto.prototype, "fields", void 0);
class SaveCardDto {
    template_id;
    call_uniqueid;
    caller_id;
    queue_name;
    status;
    field_values;
}
exports.SaveCardDto = SaveCardDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SaveCardDto.prototype, "template_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SaveCardDto.prototype, "call_uniqueid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], SaveCardDto.prototype, "caller_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SaveCardDto.prototype, "queue_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...exports.CARD_STATUS_VALUES]),
    __metadata("design:type", String)
], SaveCardDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SaveCardDto.prototype, "field_values", void 0);
class UpdateCardDto {
    call_uniqueid;
    caller_id;
    queue_name;
    status;
    field_values;
}
exports.UpdateCardDto = UpdateCardDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], UpdateCardDto.prototype, "call_uniqueid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], UpdateCardDto.prototype, "caller_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], UpdateCardDto.prototype, "queue_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...exports.CARD_STATUS_VALUES]),
    __metadata("design:type", String)
], UpdateCardDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateCardDto.prototype, "field_values", void 0);
//# sourceMappingURL=callcenter-cards.dto.js.map