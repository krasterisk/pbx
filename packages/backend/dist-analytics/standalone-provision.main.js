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
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const bcrypt = __importStar(require("bcrypt"));
const core_1 = require("@nestjs/core");
const standalone_ai_core_module_1 = require("./compositions/standalone-ai-core.module");
const tenant_identity_service_1 = require("./modules/tenant-identity/tenant-identity.service");
/** Installer-only command. Reads the password from a pipe, never argv or environment. */
async function main() {
    const profile = process.env.DB_SCHEMA_PROFILE;
    if (profile !== 'analytics-api' && profile !== 'robot-api') {
        throw new Error('DB_SCHEMA_PROFILE must be analytics-api or robot-api');
    }
    const login = process.env.STANDALONE_ADMIN_LOGIN?.trim() ?? '';
    const name = process.env.STANDALONE_ADMIN_NAME?.trim() ?? '';
    const companyName = process.env.STANDALONE_COMPANY_NAME?.trim() ?? '';
    if (!login || !name || !companyName || process.stdin.isTTY) {
        throw new Error('Set admin login/name/company and pipe the password to stdin');
    }
    const password = (0, node_fs_1.readFileSync)(0, 'utf8').replace(/\r?\n$/, '');
    if (password.length < 12 || password.length > 128 || /[\r\n\0]/.test(password)) {
        throw new Error('Admin password must be 12–128 characters');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const app = await core_1.NestFactory.createApplicationContext(standalone_ai_core_module_1.StandaloneAiCoreModule.forProfile(profile), { logger: false });
    try {
        const identities = app.get(tenant_identity_service_1.TenantIdentityService);
        const result = await identities.create({
            login, name, companyName, passwordHash, activateImmediately: true,
        }, 'standalone-ai');
        process.stdout.write(`Provisioned tenant ${result.tenant.vpbx_user_uid}\n`);
    }
    finally {
        await app.close();
    }
}
void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Provisioning failed'}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=standalone-provision.main.js.map