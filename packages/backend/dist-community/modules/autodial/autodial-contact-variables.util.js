"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autodialContactVariables = autodialContactVariables;
/** Preserve legacy field values; new phone fields resolve from the dialed phone. */
function autodialContactVariables(fields, values, number) {
    const variables = {};
    for (const field of fields) {
        const value = values[String(field.uid)]
            ?? (field.is_phone || field.type === 'phone' ? number : undefined);
        if (value == null)
            continue;
        variables[`__${field.var_name}`] = String(value).replace(/[\r\n,]/g, ' ').slice(0, 255);
    }
    return variables;
}
//# sourceMappingURL=autodial-contact-variables.util.js.map