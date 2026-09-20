"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lastVoiceRobotTagSql = lastVoiceRobotTagSql;
exports.literalLikePattern = literalLikePattern;
/** Fixed SQL expressions only; request values stay in Sequelize conditions/replacements. */
function lastVoiceRobotTagSql(dialect) {
    if (dialect === 'mysql') {
        const tags = '`tags`';
        const last = `JSON_EXTRACT(${tags}, CONCAT('$[', JSON_LENGTH(${tags}) - 1, ']'))`;
        return `(CASE WHEN JSON_TYPE(${tags}) = 'ARRAY' AND JSON_LENGTH(${tags}) > 0
      THEN CASE WHEN JSON_TYPE(${last}) = 'STRING' THEN JSON_UNQUOTE(${last}) ELSE NULL END
      ELSE NULL END) COLLATE utf8mb4_bin`;
    }
    if (dialect === 'postgres') {
        const tags = '"tags"::jsonb';
        const last = `(${tags} -> (jsonb_array_length(${tags}) - 1))`;
        return `CASE WHEN jsonb_typeof(${tags}) = 'array' AND jsonb_array_length(${tags}) > 0
      THEN CASE WHEN jsonb_typeof(${last}) = 'string' THEN ${tags} ->> (jsonb_array_length(${tags}) - 1) ELSE NULL END
      ELSE NULL END`;
    }
    throw new Error(`Unsupported voice robot CDR dialect: ${dialect}`);
}
/** Literal substring search; LIKE wildcard characters in input are data. */
function literalLikePattern(value) {
    return `%${value.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}
//# sourceMappingURL=voice-robot-cdr-query.js.map