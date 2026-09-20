"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CC_SUPERVISOR_LEVELS = void 0;
exports.isSupervisorUser = isSupervisorUser;
exports.assertSupervisor = assertSupervisor;
/**
 * Call-center supervisor/admin gate.
 *
 * UserLevel is inverted privilege (SUPERADMIN=0, ADMIN=1, SUPERVISOR=3).
 * Numeric `level >= 3` would block ADMIN and allow READONLY — use set membership.
 */
const common_1 = require("@nestjs/common");
const user_model_1 = require("../users/user.model");
exports.CC_SUPERVISOR_LEVELS = new Set([
    user_model_1.UserLevel.SUPERADMIN,
    user_model_1.UserLevel.ADMIN,
    user_model_1.UserLevel.SUPERVISOR,
]);
function isSupervisorUser(user) {
    return exports.CC_SUPERVISOR_LEVELS.has(Number(user?.level));
}
function assertSupervisor(user) {
    if (!isSupervisorUser(user)) {
        throw new common_1.ForbiddenException('Supervisor access required');
    }
}
//# sourceMappingURL=callcenter-rbac.util.js.map