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
var DialplanSubroutinesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanSubroutinesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_apply_service_1 = require("../ami/dialplan-apply.service");
const dialplan_subroutines_util_1 = require("../../shared/utils/dialplan-subroutines.util");
/**
 * Generates and applies the global Asterisk subroutines file via AMI UpdateConfig.
 *
 * File: krasterisk/subroutines/subroutines.conf
 * Auto-picked up by: #include krasterisk/*\/*.conf  (already in extensions.conf)
 *
 * Ops (once per stand): AMI CreateConfig cannot mkdir — ensure parent dirs exist:
 *   mkdir -p $AST_CONFIG_DIR/krasterisk/{groups,routes,phonebooks,subroutines,ivrs}
 *   && chown -R asterisk:asterisk $AST_CONFIG_DIR/krasterisk
 *
 * Applied automatically on backend startup (onModuleInit + 5s delay for AMI connect).
 * Can be re-applied manually via POST /api/system-settings/apply-subroutines.
 *
 * Contents: [krsk-on-answer] + [krsk-hangup-handler] + [krsk-click-to-call]
 */
let DialplanSubroutinesService = class DialplanSubroutinesService {
    static { DialplanSubroutinesService_1 = this; }
    dialplanApplyService;
    config;
    logger = new common_1.Logger(DialplanSubroutinesService_1.name);
    /**
     * Path to the subroutines config file (relative to Asterisk config dir).
     *
     * extensions.conf uses: #include krasterisk/*\/*.conf
     * So the file MUST be TWO levels deep: krasterisk/{subdir}/{file}.conf
     * → krasterisk/subroutines/subroutines.conf ✅
     * → krasterisk/subroutines.conf             ❌ (not matched by glob)
     */
    static SUBROUTINES_FILE = 'krasterisk/subroutines/subroutines.conf';
    constructor(dialplanApplyService, config) {
        this.dialplanApplyService = dialplanApplyService;
        this.config = config;
    }
    async onModuleInit() {
        // Delay slightly to let AMI connection establish before writing
        setTimeout(() => this.applySubroutines().catch(() => { }), 5000);
    }
    /**
     * Generate subroutines content and write to Asterisk config via AMI UpdateConfig.
     * Safe to call multiple times — always overwrites previous content.
     */
    async applySubroutines() {
        const backendUrl = this.config.get('DIALPLAN_BACKEND_URL')
            || `http://127.0.0.1:${this.config.get('BACKEND_PORT') || 5010}/api`;
        const apiKey = this.config.get('DIALPLAN_API_KEY') || '';
        const recordsBase = this.config.get('RECORDS_BASE_PATH') || '/usr/records';
        const content = dialplan_subroutines_util_1.DialplanSubroutinesUtil.generate(backendUrl, apiKey, recordsBase);
        const contexts = dialplan_subroutines_util_1.DialplanSubroutinesUtil.parseCategories(content);
        const file = DialplanSubroutinesService_1.SUBROUTINES_FILE;
        // A leftover [ctx] in the same file (failed DelCat) makes Asterisk merge
        // two copies of the same extension. Purge each name twice, then rewrite.
        const names = contexts.map((ctx) => ctx.name);
        await this.dialplanApplyService.deleteCategories(file, [...names, ...names], { reload: false });
        const result = await this.dialplanApplyService.applyCategories(file, contexts, { reload: true });
        this.logger.log(`✅ Subroutines applied: ${file} (${result.linesApplied} lines, ${contexts.length} contexts)`);
        return { success: result.success, linesApplied: result.linesApplied };
    }
};
exports.DialplanSubroutinesService = DialplanSubroutinesService;
exports.DialplanSubroutinesService = DialplanSubroutinesService = DialplanSubroutinesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [dialplan_apply_service_1.DialplanApplyService,
        config_1.ConfigService])
], DialplanSubroutinesService);
//# sourceMappingURL=dialplan-subroutines.service.js.map