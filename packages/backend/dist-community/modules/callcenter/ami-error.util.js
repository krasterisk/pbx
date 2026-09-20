"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.amiFailureMessage = amiFailureMessage;
exports.isAlreadyQueueMemberError = isAlreadyQueueMemberError;
/** Human text from an AMI reject — asterisk-manager often passes a raw response object. */
function amiFailureMessage(err) {
    if (err == null)
        return '';
    if (typeof err === 'string')
        return err;
    if (err instanceof Error)
        return err.message || '';
    if (typeof err === 'object') {
        const o = err;
        const parts = [o.message, o.Message, o.msg, o.reason];
        const text = parts
            .filter((p) => typeof p === 'string' && p.trim().length > 0)
            .join(' ');
        if (text)
            return text;
        try {
            return JSON.stringify(err);
        }
        catch {
            return '';
        }
    }
    return String(err);
}
function isAlreadyQueueMemberError(err) {
    const msg = amiFailureMessage(err);
    return /already there/i.test(msg) || /already a member/i.test(msg);
}
//# sourceMappingURL=ami-error.util.js.map