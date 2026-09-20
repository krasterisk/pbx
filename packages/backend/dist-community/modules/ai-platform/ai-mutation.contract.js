"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonSchemaOf = jsonSchemaOf;
exports.assertNoTenantAliases = assertNoTenantAliases;
exports.stripTenantAliasesDeep = stripTenantAliasesDeep;
exports.parseMutationInput = parseMutationInput;
exports.parseMutationArgs = parseMutationArgs;
exports.isToolRefusal = isToolRefusal;
exports.isToolSkip = isToolSkip;
exports.defineMutationTool = defineMutationTool;
const zod_1 = require("zod");
const ai_adapter_types_1 = require("./ai-adapter.types");
/** Recognized as "an object literal", as opposed to an array or a class instance. */
function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function isStrictObjectSchema(schema) {
    const def = schema._zod?.def;
    if (def?.type !== 'object')
        return false;
    const catchall = def.catchall;
    return catchall?._zod?.def?.type === 'never';
}
/**
 * JSON schema for the model, generated from the executable schema so the two
 * cannot describe different arguments.
 */
function jsonSchemaOf(schema) {
    const generated = zod_1.z.toJSONSchema(schema, { target: 'draft-7', io: 'input' });
    return {
        type: 'object',
        properties: (generated.properties ?? {}),
        required: (generated.required ?? []),
        additionalProperties: false,
    };
}
/**
 * D-22, recursive: a strict top-level schema stops a forged `vpbxUserUid` at the
 * root, but dialplan params are deliberately open records. Reject a tenant alias
 * wherever it hides instead of hoping the leaf schema catches it.
 */
function assertNoTenantAliases(value, path = '') {
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertNoTenantAliases(item, `${path}[${index}]`));
        return;
    }
    if (!isPlainObject(value))
        return;
    for (const [key, child] of Object.entries(value)) {
        if (ai_adapter_types_1.TENANT_ARG_KEYS.includes(key)) {
            throw new Error(`TENANT_ARG_FORBIDDEN:${path ? `${path}.` : ''}${key}`);
        }
        assertNoTenantAliases(child, path ? `${path}.${key}` : key);
    }
}
/** Copy without any tenant alias, at any depth. Used on stored payloads, which predate this contract. */
function stripTenantAliasesDeep(value) {
    if (Array.isArray(value)) {
        return value.map((item) => stripTenantAliasesDeep(item));
    }
    if (!isPlainObject(value))
        return value;
    const clean = {};
    for (const [key, child] of Object.entries(value)) {
        if (ai_adapter_types_1.TENANT_ARG_KEYS.includes(key))
            continue;
        clean[key] = stripTenantAliasesDeep(child);
    }
    return clean;
}
function formatIssues(error) {
    return error.issues
        .map((issue) => {
        const where = issue.path.join('.');
        const keys = issue.keys;
        const subject = keys?.length ? keys.join(', ') : where;
        return subject ? `${subject}: ${issue.message}` : issue.message;
    })
        .join('; ');
}
/** Strict parse of model-supplied arguments. Unknown and missing properties both fail. */
function parseMutationInput(mutation, raw) {
    assertNoTenantAliases(raw);
    const parsed = mutation.input.safeParse(raw ?? {});
    if (!parsed.success) {
        throw new Error(`ARGS_INVALID: ${formatIssues(parsed.error)}`);
    }
    return parsed.data;
}
/** Strict parse of the canonical server args stored in `applyPayload`. */
function parseMutationArgs(mutation, raw) {
    const parsed = mutation.args.safeParse(raw ?? {});
    if (!parsed.success) {
        throw new Error(`APPLY_ARGS_INVALID: ${formatIssues(parsed.error)}`);
    }
    return parsed.data;
}
function isToolRefusal(value) {
    return isPlainObject(value) && value.refused === true;
}
function isToolSkip(value) {
    return isPlainObject(value) && value.skipped === true;
}
/**
 * Builds the AiToolDefinition a mutation adapter registers. `inputSchema` is
 * generated here rather than written by hand, so the model can never be offered
 * a property the executable schema rejects.
 */
function defineMutationTool(spec) {
    if (!isStrictObjectSchema(spec.input)) {
        throw new Error(`${spec.name}: input must be a strict zod object (z.strictObject)`);
    }
    if (!isStrictObjectSchema(spec.args)) {
        throw new Error(`${spec.name}: args must be a strict zod object (z.strictObject)`);
    }
    const mutation = {
        schemaVersion: spec.schemaVersion,
        input: spec.input,
        args: spec.args,
        reload: spec.reload,
        propose: spec.propose,
        revalidate: spec.revalidate,
        apply: spec.apply,
    };
    return {
        name: spec.name,
        description: spec.description,
        entityType: spec.entityType,
        destructive: spec.destructive,
        proposes: true,
        inputSchema: jsonSchemaOf(spec.input).properties,
        mutation,
        /**
         * Compatibility entry point. Dispatch calls `mutation.propose` directly with
         * the real caller context; this shim exists for callers that only hold an
         * AiToolDefinition. It parses first so there is no route to `propose` that
         * skips the executable schema.
         */
        handler: async (args, vpbxUserUid) => {
            const input = parseMutationInput(mutation, args);
            const proposed = await mutation.propose(input, {
                vpbxUserUid,
                userUid: 0,
                role: 0,
                isAdmin: false,
            });
            return proposed;
        },
    };
}
//# sourceMappingURL=ai-mutation.contract.js.map