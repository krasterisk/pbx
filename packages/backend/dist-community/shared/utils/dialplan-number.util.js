"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAL_OK_VAR = exports.DIAL_MATCHED_VAR = exports.DIAL_NUM_VAR = exports.DIAL_SRC_VAR = void 0;
exports.applyNumberManipulation = applyNumberManipulation;
exports.compileDialTargetRewrite = compileDialTargetRewrite;
exports.sourceExprFromValueSource = sourceExprFromValueSource;
exports.rewriteFromParams = rewriteFromParams;
exports.wrapIfRewriteOk = wrapIfRewriteOk;
const shared_1 = require("@krasterisk/shared");
const DIALPLAN_UNSAFE = /[(),?[\]{}$\\";\n\r]/g;
exports.DIAL_SRC_VAR = 'KRSK_DIAL_SRC';
exports.DIAL_NUM_VAR = 'KRSK_DIAL_NUM';
exports.DIAL_MATCHED_VAR = 'KRSK_DIAL_MATCHED';
exports.DIAL_OK_VAR = 'KRSK_DIAL_OK';
/** Same charset as AsteriskDialplanUtils.sanitizeDialplanInput — kept local to avoid a util cycle. */
function sanitizePrepend(input) {
    return input.replace(DIALPLAN_UNSAFE, '').trim();
}
function applyNumberManipulation(raw, m) {
    if (!m)
        return raw;
    let out = raw;
    const strip = m.strip ?? 0;
    if (strip > 0) {
        if (strip >= out.length) {
            throw new Error(`numberManipulation.strip ${strip} exceeds number length ${out.length}`);
        }
        out = out.slice(strip);
    }
    if (m.prepend) {
        out = `${sanitizePrepend(m.prepend)}${out}`;
    }
    return out;
}
function sanitizeDialValue(input) {
    if (!input)
        return '';
    return input.replace(DIALPLAN_UNSAFE, '').trim();
}
function filterChars(charset) {
    if (charset === 'exten')
        return '0-9A-Za-z*#+';
    return '0-9+*#';
}
function conditionExpr(srcVar, condition) {
    switch (condition.kind) {
        case 'eq': {
            const value = sanitizeDialValue(condition.value);
            return `$["\${${srcVar}}" = "${value}"]`;
        }
        case 'startsWith': {
            const prefix = sanitizeDialValue(condition.value);
            if (!prefix)
                return undefined;
            return `$["\${${srcVar}:0:${prefix.length}}" = "${prefix}"]`;
        }
        case 'endsWith': {
            const suffix = sanitizeDialValue(condition.value);
            if (!suffix)
                return undefined;
            return `$["\${${srcVar}:-${suffix.length}}" = "${suffix}"]`;
        }
        case 'length': {
            const parts = [];
            if (condition.min != null && Number.isFinite(condition.min)) {
                parts.push(`$[\${LEN(${srcVar})} >= ${Math.trunc(condition.min)}]`);
            }
            if (condition.max != null && Number.isFinite(condition.max)) {
                parts.push(`$[\${LEN(${srcVar})} <= ${Math.trunc(condition.max)}]`);
            }
            if (!parts.length && condition.value != null && condition.value !== '') {
                const n = Number(condition.value);
                if (Number.isFinite(n))
                    parts.push(`$["\${LEN(${srcVar})}" = "${Math.trunc(n)}"]`);
            }
            if (!parts.length)
                return undefined;
            return parts.length === 1 ? parts[0] : `$[${parts.map((p) => p.slice(2, -1)).join(' & ')}]`;
        }
        case 'digitMask': {
            const mask = String(condition.value ?? '');
            if (!mask)
                return undefined;
            const pattern = (0, shared_1.digitMaskToRegex)(mask);
            if (!(0, shared_1.isAllowedRewriteRegex)(pattern.replace(/^\^/, '').replace(/\$$/, '')) && !(0, shared_1.isAllowedRewriteRegex)(pattern)) {
                if (!/^[0-9A-Za-zXx+*#]+$/.test(mask))
                    return undefined;
            }
            return `$[\${REGEX("${pattern}" \${${srcVar}})} = 1]`;
        }
        case 'regex': {
            const pattern = String(condition.value ?? '');
            if (!(0, shared_1.isAllowedRewriteRegex)(pattern))
                return undefined;
            return `$[\${REGEX("${pattern}" \${${srcVar}})} = 1]`;
        }
        default:
            return undefined;
    }
}
function andExprs(parts) {
    if (!parts.length)
        return '$[1]';
    if (parts.length === 1)
        return parts[0];
    const inner = parts.map((p) => {
        if (p.startsWith('$[') && p.endsWith(']'))
            return p.slice(2, -1);
        return p;
    });
    return `$[${inner.join(' & ')}]`;
}
function transformLines(gate, transform) {
    const lines = [];
    const exec = (app) => `ExecIf(${gate}?${app})`;
    lines.push(exec(`Set(${exports.DIAL_NUM_VAR}=\${${exports.DIAL_SRC_VAR}})`));
    if (transform.replaceAll != null && transform.replaceAll !== '') {
        lines.push(exec(`Set(${exports.DIAL_NUM_VAR}=${sanitizeDialValue(transform.replaceAll)})`));
    }
    const startCount = transform.stripStartCount ?? 0;
    if (startCount > 0) {
        lines.push(exec(`Set(${exports.DIAL_NUM_VAR}=\${${exports.DIAL_NUM_VAR}:${startCount}})`));
    }
    if (transform.stripStartText) {
        const text = sanitizeDialValue(transform.stripStartText);
        if (text) {
            const textGate = andExprs([
                gate,
                `$["\${${exports.DIAL_NUM_VAR}:0:${text.length}}" = "${text}"]`,
            ]);
            lines.push(`ExecIf(${textGate}?Set(${exports.DIAL_NUM_VAR}=\${${exports.DIAL_NUM_VAR}:${text.length}}))`);
        }
    }
    const endCount = transform.stripEndCount ?? 0;
    if (endCount > 0) {
        lines.push(exec(`Set(${exports.DIAL_NUM_VAR}=\${${exports.DIAL_NUM_VAR}:0:-${endCount}})`));
    }
    if (transform.stripEndText) {
        const text = sanitizeDialValue(transform.stripEndText);
        if (text) {
            const textGate = andExprs([
                gate,
                `$["\${${exports.DIAL_NUM_VAR}:-${text.length}}" = "${text}"]`,
            ]);
            lines.push(`ExecIf(${textGate}?Set(${exports.DIAL_NUM_VAR}=\${${exports.DIAL_NUM_VAR}:0:-${text.length}}))`);
        }
    }
    if (transform.replaceFind) {
        const find = sanitizeDialValue(transform.replaceFind);
        const repl = sanitizeDialValue(transform.replaceWith);
        if (find) {
            lines.push(exec(`Set(${exports.DIAL_NUM_VAR}=\${STRREPLACE(${exports.DIAL_NUM_VAR},${find},${repl})})`));
        }
    }
    if (transform.prefix) {
        lines.push(exec(`Set(${exports.DIAL_NUM_VAR}=${sanitizeDialValue(transform.prefix)}\${${exports.DIAL_NUM_VAR}})`));
    }
    if (transform.postfix) {
        lines.push(exec(`Set(${exports.DIAL_NUM_VAR}=\${${exports.DIAL_NUM_VAR}}${sanitizeDialValue(transform.postfix)})`));
    }
    lines.push(exec(`Set(${exports.DIAL_MATCHED_VAR}=1)`));
    return lines;
}
function compileDialTargetRewrite(sourceExpr, rewrite, charset = 'phone') {
    if (!(0, shared_1.rewriteHasWork)(rewrite)) {
        return { lines: [], destExpr: sourceExpr, usedRewrite: false };
    }
    const lines = [
        `Set(${exports.DIAL_SRC_VAR}=${sourceExpr})`,
        `Set(${exports.DIAL_MATCHED_VAR}=0)`,
        `Set(${exports.DIAL_NUM_VAR}=)`,
        `Set(${exports.DIAL_OK_VAR}=0)`,
    ];
    for (const rule of rewrite?.rules ?? []) {
        if (rule.enabled === false)
            continue;
        const conds = (rule.conditions ?? [])
            .map((c) => conditionExpr(exports.DIAL_SRC_VAR, c))
            .filter((c) => Boolean(c));
        const gate = andExprs([`$["\${${exports.DIAL_MATCHED_VAR}}" = "0"]`, ...conds]);
        lines.push(...transformLines(gate, rule.transform ?? {}));
    }
    const noMatch = rewrite?.noMatch === 'reject' ? 'reject' : 'passthrough';
    if (noMatch === 'passthrough') {
        lines.push(`ExecIf($["\${${exports.DIAL_MATCHED_VAR}}" = "0"]?Set(${exports.DIAL_NUM_VAR}=\${${exports.DIAL_SRC_VAR}}))`);
        lines.push(`ExecIf($["\${${exports.DIAL_MATCHED_VAR}}" = "0"]?Set(${exports.DIAL_MATCHED_VAR}=1))`);
    }
    const allowed = filterChars(charset);
    lines.push(`ExecIf($["\${${exports.DIAL_NUM_VAR}}" != "" & "\${FILTER(${allowed},\${${exports.DIAL_NUM_VAR}})}" = "\${${exports.DIAL_NUM_VAR}}"]?Set(${exports.DIAL_OK_VAR}=1))`);
    lines.push(`ExecIf($["\${${exports.DIAL_OK_VAR}}" != "1"]?NoOp(Invalid rewritten dest))`);
    return {
        lines,
        destExpr: `\${${exports.DIAL_NUM_VAR}}`,
        usedRewrite: true,
    };
}
function sourceExprFromValueSource(src, directoryValueVar) {
    if (src.source === 'fixed') {
        return sanitizeDialValue(src.value);
    }
    if (src.source === 'variable' || src.source === 'autodial_field') {
        const name = sanitizeDialValue(src.name);
        return name ? `\${${name}}` : '';
    }
    if (src.source === 'original_caller') {
        return '${KRSK_ORIG_CALLER_NUM}';
    }
    if (src.source === 'current_caller') {
        return '${CALLERID(num)}';
    }
    if (src.source === 'directory') {
        return directoryValueVar ? `\${${directoryValueVar}}` : '';
    }
    return '${EXTEN}';
}
function rewriteFromParams(params) {
    return (0, shared_1.coerceDialTargetRewrite)(params);
}
function wrapIfRewriteOk(usedRewrite, app) {
    if (!usedRewrite)
        return app;
    return `ExecIf($["\${${exports.DIAL_OK_VAR}}" = "1"]?${app})`;
}
//# sourceMappingURL=dialplan-number.util.js.map