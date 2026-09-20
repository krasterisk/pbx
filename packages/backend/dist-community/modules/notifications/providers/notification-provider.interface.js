"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_MESSAGE_MAX_LEN = exports.ATTACHMENT_REJECTED = void 0;
exports.trimNotificationMessage = trimNotificationMessage;
/** Telegram payload/format rejection (4xx). Distinct from transport/5xx. */
exports.ATTACHMENT_REJECTED = 'attachment_rejected';
exports.NOTIFICATION_MESSAGE_MAX_LEN = 4096;
function trimNotificationMessage(message) {
    const text = message ?? '';
    return text.length > exports.NOTIFICATION_MESSAGE_MAX_LEN
        ? text.slice(0, exports.NOTIFICATION_MESSAGE_MAX_LEN)
        : text;
}
//# sourceMappingURL=notification-provider.interface.js.map