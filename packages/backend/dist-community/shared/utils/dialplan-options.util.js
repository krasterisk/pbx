"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOptions = parseOptions;
exports.serializeOptions = serializeOptions;
function parseOptions(input) {
    const tokens = [];
    let i = 0;
    while (i < input.length) {
        const start = i;
        i += 1;
        if (input[i] === '(') {
            let depth = 1;
            i += 1;
            while (i < input.length && depth > 0) {
                if (input[i] === '(')
                    depth += 1;
                else if (input[i] === ')')
                    depth -= 1;
                i += 1;
            }
        }
        tokens.push(input.slice(start, i));
    }
    return { tokens };
}
function serializeOptions(set) {
    return (set?.tokens ?? []).join('');
}
//# sourceMappingURL=dialplan-options.util.js.map