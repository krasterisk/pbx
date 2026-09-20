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
var AutodialRollupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialRollupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const autodial_state_service_1 = require("./autodial-state.service");
/**
 * Nightly aggregation of `ac_attempts` into `ac_daily_campaign_stats`, matching
 * the cc_daily_queue_stats pattern. Reports over closed days then never touch
 * the attempt table.
 */
let AutodialRollupService = AutodialRollupService_1 = class AutodialRollupService {
    sequelize;
    state;
    logger = new common_1.Logger(AutodialRollupService_1.name);
    constructor(sequelize, state) {
        this.sequelize = sequelize;
        this.state = state;
    }
    /** 00:20 local — after Asterisk has flushed the last CDRs of the day. */
    async nightlyRollup() {
        const day = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        try {
            const rows = await this.rollupDay(day);
            this.logger.log(`Autodial rollup for ${day}: ${rows} campaign row(s)`);
        }
        catch (e) {
            this.logger.error(`Autodial rollup for ${day} failed: ${e.message}`);
        }
        // Live counters are per reporting day, so they reset with the rollup.
        this.state.resetDailyCounters();
    }
    /**
     * Idempotent: re-running a day replaces its rows rather than doubling them.
     * Exposed so a missed night can be backfilled by hand.
     */
    async rollupDay(day) {
        await this.sequelize.query('DELETE FROM ac_daily_campaign_stats WHERE day = :day', {
            replacements: { day },
            type: sequelize_2.QueryTypes.DELETE,
        });
        const [inserted] = await this.sequelize.query(`INSERT INTO ac_daily_campaign_stats
         (vpbx_user_uid, campaign_uid, day, dials, answered, success, short,
          no_answer, busy, amd, failed, talk_sec_sum, billsec_sum)
       SELECT vpbx_user_uid,
              campaign_uid,
              :day,
              COUNT(*),
              SUM(answered_at IS NOT NULL),
              SUM(disposition = 'success'),
              SUM(disposition = 'answered_short'),
              SUM(disposition = 'no_answer'),
              SUM(disposition = 'busy'),
              SUM(disposition IN ('amd_machine','voicemail')),
              SUM(disposition IN ('failed','congestion','invalid_number')),
              COALESCE(SUM(talk_sec), 0),
              COALESCE(SUM(billsec), 0)
         FROM ac_attempts
        WHERE started_at >= :dayStart
          AND started_at < :dayEnd
          AND disposition <> 'dialing'
        GROUP BY vpbx_user_uid, campaign_uid`, {
            replacements: {
                day,
                dayStart: `${day} 00:00:00`,
                dayEnd: `${day} 23:59:59`,
            },
            type: sequelize_2.QueryTypes.INSERT,
        });
        return typeof inserted === 'number' ? inserted : 0;
    }
};
exports.AutodialRollupService = AutodialRollupService;
__decorate([
    (0, schedule_1.Cron)('0 20 0 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutodialRollupService.prototype, "nightlyRollup", null);
exports.AutodialRollupService = AutodialRollupService = AutodialRollupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectConnection)()),
    __metadata("design:paramtypes", [Function, autodial_state_service_1.AutodialStateService])
], AutodialRollupService);
function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
//# sourceMappingURL=autodial-rollup.service.js.map