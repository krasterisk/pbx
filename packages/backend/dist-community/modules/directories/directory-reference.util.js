"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDirectoryReferences = collectDirectoryReferences;
const action_reference_util_1 = require("../route-references/action-reference.util");
function collectDirectoryReferences(directoryUid, fieldUid, bindings, routes) {
    return (0, action_reference_util_1.collectActionReferences)('directory', directoryUid, routes, bindings, fieldUid);
}
//# sourceMappingURL=directory-reference.util.js.map