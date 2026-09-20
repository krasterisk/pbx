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
var DialplanApplyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanApplyService = void 0;
const common_1 = require("@nestjs/common");
const ami_service_1 = require("./ami.service");
const BATCH_SIZE = 20;
/** AMI CreateConfig O_CREAT|O_EXCL — file already present; UpdateConfig can proceed. */
function isCreateConfigFileExistsError(message) {
    const m = message.toLowerCase();
    return (m.includes('already exists') ||
        m.includes('file exists') ||
        m.includes('eexist'));
}
/**
 * DialplanApplyService — единая точка применения dialplan-контекстов через AMI:
 * CreateConfig (ensure empty file) → UpdateConfig (DelCat → NewCat → Append батчами)
 * → опциональный dialplan reload.
 *
 * AMI CreateConfig cannot create parent directories — ops must mkdir
 * krasterisk/{groups,routes,phonebooks,subroutines,ivrs} under AST_CONFIG_DIR.
 *
 * Консолидирует батч-логику, ранее продублированную в routes.controller,
 * mcp-tools.service и dialplan-subroutines.service (D-22).
 *
 * Интерфейс — шов на будущий FS-writer (альтернативная реализация за env-флагом),
 * без изменения вызывающих.
 */
let DialplanApplyService = DialplanApplyService_1 = class DialplanApplyService {
    amiService;
    logger = new common_1.Logger(DialplanApplyService_1.name);
    constructor(amiService) {
        this.amiService = amiService;
    }
    /**
     * Ensures the config file exists via AMI CreateConfig (empty file).
     * Idempotent when the file already exists; rethrows real failures
     * (missing parent dir / true privileges) before UpdateConfig.
     */
    async ensureConfigFile(filename) {
        try {
            await this.amiService.action({
                action: 'CreateConfig',
                filename,
            });
        }
        catch (e) {
            const message = String(e?.message || e);
            if (isCreateConfigFileExistsError(message)) {
                return;
            }
            this.logger.error(`CreateConfig failed for ${filename}: ${message}`);
            throw e;
        }
    }
    /**
     * Applies one or more dialplan categories to a config file via AMI:
     * CreateConfig (ensure file) → UpdateConfig DelCat/NewCat/Append in the order given,
     * then optionally reloads the dialplan once at the end.
     */
    async applyCategories(filename, categories, opts = {}) {
        await this.ensureConfigFile(filename);
        let totalLines = 0;
        for (const category of categories) {
            const lines = category.lines
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith('[') && !l.startsWith(';'));
            // Step 1: Delete existing category (silently fails if doesn't exist)
            try {
                await this.amiService.action({
                    action: 'UpdateConfig',
                    srcfilename: filename,
                    dstfilename: filename,
                    reload: 'no',
                    'Action-000000': 'DelCat',
                    'Cat-000000': category.name,
                });
            }
            catch (e) {
                // Expected: category or file doesn't exist yet
            }
            // Step 2: Create category
            try {
                await this.amiService.action({
                    action: 'UpdateConfig',
                    srcfilename: filename,
                    dstfilename: filename,
                    reload: 'no',
                    'Action-000000': 'NewCat',
                    'Cat-000000': category.name,
                });
            }
            catch (e) {
                this.logger.error(`Failed to create category [${category.name}]: ${e?.message || e}`);
                throw e;
            }
            // Step 3: Append lines in batches (AMI limit: ~32 headers per request)
            for (let batchStart = 0; batchStart < lines.length; batchStart += BATCH_SIZE) {
                const batch = lines.slice(batchStart, batchStart + BATCH_SIZE);
                const batchAction = {
                    action: 'UpdateConfig',
                    srcfilename: filename,
                    dstfilename: filename,
                    reload: 'no',
                };
                batch.forEach((line, idx) => {
                    const paddedIdx = String(idx).padStart(6, '0');
                    batchAction[`Action-${paddedIdx}`] = 'Append';
                    batchAction[`Cat-${paddedIdx}`] = category.name;
                    // Split on first '=>' or '=' to extract Var/Value for AMI
                    const arrowPos = line.indexOf('=>');
                    if (arrowPos !== -1) {
                        batchAction[`Var-${paddedIdx}`] = line.substring(0, arrowPos).trim();
                        batchAction[`Value-${paddedIdx}`] = `> ${line.substring(arrowPos + 2).trim()}`;
                    }
                    else {
                        const eqPos = line.indexOf('=');
                        if (eqPos !== -1) {
                            batchAction[`Var-${paddedIdx}`] = line.substring(0, eqPos).trim();
                            batchAction[`Value-${paddedIdx}`] = line.substring(eqPos + 1).trim();
                        }
                        else {
                            batchAction[`Var-${paddedIdx}`] = line;
                            batchAction[`Value-${paddedIdx}`] = '';
                        }
                    }
                });
                try {
                    const res = await this.amiService.action(batchAction);
                    if (res && res.response === 'Error') {
                        this.logger.error(`AMI Append error for [${category.name}]: ${res.message || 'Unknown'}`);
                        throw new Error(`AMI UpdateConfig Append failed: ${res.message || 'Unknown error'}`);
                    }
                }
                catch (e) {
                    this.logger.error(`Failed to apply dialplan for [${category.name}]: ${e?.message || e}`);
                    throw e;
                }
            }
            totalLines += lines.length;
            this.logger.log(`Dialplan applied: [${category.name}] ${lines.length} lines`);
        }
        if (opts.reload !== false) {
            await this.amiService.command('dialplan reload');
        }
        return { success: true, linesApplied: totalLines };
    }
    /**
     * Delete one or more categories from a config file (DelCat only — no NewCat/Append).
     *
     * Used to clean up orphaned per-binding categories (`pb_bind_{uid}_{vpbx}`) after
     * their `route_phonebook_bindings` row is destroyed (e.g. phonebook delete) — the
     * category would otherwise remain in the .conf file referencing nothing (Pitfall 5).
     */
    async deleteCategories(filename, categoryNames, opts = {}) {
        for (const name of categoryNames) {
            try {
                await this.amiService.action({
                    action: 'UpdateConfig',
                    srcfilename: filename,
                    dstfilename: filename,
                    reload: 'no',
                    'Action-000000': 'DelCat',
                    'Cat-000000': name,
                });
            }
            catch (e) {
                // Expected: category may already be gone
            }
        }
        if (opts.reload !== false) {
            await this.amiService.command('dialplan reload');
        }
        return { success: true };
    }
};
exports.DialplanApplyService = DialplanApplyService;
exports.DialplanApplyService = DialplanApplyService = DialplanApplyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ami_service_1.AmiService])
], DialplanApplyService);
//# sourceMappingURL=dialplan-apply.service.js.map