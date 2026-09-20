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
exports.ProvisionController = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ps_endpoint_model_1 = require("./ps-endpoint.model");
const provision_template_model_1 = require("./provision-template.model");
const ps_auth_model_1 = require("./ps-auth.model");
let ProvisionController = class ProvisionController {
    endpointModel;
    templateModel;
    authModel;
    constructor(endpointModel, templateModel, authModel) {
        this.endpointModel = endpointModel;
        this.templateModel = templateModel;
        this.authModel = authModel;
    }
    async getProvisioningFile(filename, req, res) {
        if (!filename)
            throw new common_1.NotFoundException('Filename missing');
        // Extract exact 12 hexadecimal characters from the filename to strip vendor prefixes like 'SEP' or 'cfg'
        const macMatch = filename.replace(/[:-]/g, '').match(/[0-9a-f]{12}/i);
        if (!macMatch) {
            throw new common_1.NotFoundException('MAC address format not recognized in filename');
        }
        const cleanMac = macMatch[0].toLowerCase();
        // Find endpoint by MAC
        const endpoint = await this.endpointModel.findOne({
            where: { mac_address: cleanMac },
            attributes: ['id', 'mac_address', 'provision_enabled', 'provision_template_id', 'pv_vars', 'callerid']
        });
        if (!endpoint || !endpoint.provision_enabled || !endpoint.provision_template_id) {
            throw new common_1.NotFoundException('Provisioning not configured for this MAC');
        }
        const template = await this.templateModel.findByPk(endpoint.provision_template_id);
        if (!template) {
            throw new common_1.NotFoundException('Template not found');
        }
        const auth = await this.authModel.findByPk(endpoint.id, {
            attributes: ['id', 'password', 'username']
        });
        // Dynamic Variables (System vars prefix $)
        const baseVars = {
            '$sip_server': process.env.SIP_DOMAIN || req.headers.host?.split(':')[0] || 'localhost',
            '$sip_port': process.env.SIP_PORT || '5060',
            '$extension': endpoint.id.match(/^e(.+)_\d+$/)?.[1] || endpoint.id,
            '$username': auth?.username || endpoint.id,
            '$password': auth?.password || '',
            '$display_name': endpoint.callerid?.replace(/"/g, '') || endpoint.id,
        };
        // User defined pv_vars parsing (format key=value per line)
        const customVars = {};
        if (endpoint.pv_vars) {
            for (const line of endpoint.pv_vars.split('\n')) {
                const [k, ...v] = line.split('=');
                if (k && v.length) {
                    customVars[k.trim()] = v.join('=').trim();
                }
            }
        }
        const allVars = { ...baseVars, ...customVars };
        let renderedContent = template.content || '';
        // Replace all variables
        for (const [key, val] of Object.entries(allVars)) {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            renderedContent = renderedContent.replace(new RegExp(escapedKey, 'g'), val);
        }
        // Return appropriate content type based on extension
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext === 'xml') {
            res.setHeader('Content-Type', 'application/xml');
        }
        else {
            res.setHeader('Content-Type', 'text/plain');
        }
        res.status(200).send(renderedContent);
    }
};
exports.ProvisionController = ProvisionController;
__decorate([
    (0, common_1.Get)(':filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProvisionController.prototype, "getProvisioningFile", null);
exports.ProvisionController = ProvisionController = __decorate([
    (0, common_1.Controller)('provision'),
    __param(0, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __param(1, (0, sequelize_1.InjectModel)(provision_template_model_1.ProvisionTemplate)),
    __param(2, (0, sequelize_1.InjectModel)(ps_auth_model_1.PsAuth)),
    __metadata("design:paramtypes", [Object, Object, Object])
], ProvisionController);
//# sourceMappingURL=provision.controller.js.map