"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdrService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelize_2 = require("sequelize");
const cdr_model_1 = require("./cdr.model");
const user_model_1 = require("../../users/user.model");
const number_list_model_1 = require("../../numbers/number-list.model");
const cdr_utils_1 = require("./cdr.utils");
const system_settings_service_1 = require("../../system-settings/system-settings.service");
const ps_endpoint_model_1 = require("../../endpoints/ps-endpoint.model");
const cdr_access_scope_1 = require("./cdr-access-scope");
const callcenter_access_list_util_1 = require("../../callcenter/callcenter-access-list.util");
const cdr_query_compat_1 = require("../../../database/cdr-query-compat");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let CdrService = class CdrService {
    cdrModel;
    endpointModel;
    userModel;
    numberListModel;
    sequelize;
    systemSettings;
    constructor(cdrModel, endpointModel, userModel, numberListModel, sequelize, systemSettings) {
        this.cdrModel = cdrModel;
        this.endpointModel = endpointModel;
        this.userModel = userModel;
        this.numberListModel = numberListModel;
        this.sequelize = sequelize;
        this.systemSettings = systemSettings;
    }
    legFilter(vpbxUserUid) {
        const tenant = (0, cdr_utils_1.tenantLegFilter)(vpbxUserUid);
        return {
            where: `${tenant.sql} AND c.lastapp <> 'Transferred Call'`,
            replacements: { ...tenant.replacements },
        };
    }
    async resolveCdrAccess(viewerUserId) {
        if (!viewerUserId)
            return null;
        const user = await this.userModel.findOne({
            where: { uniqueid: viewerUserId },
            attributes: ['uniqueid', 'numbers_id', 'exten', 'login', 'level'],
        });
        if (!user)
            return null;
        const level = Number(user.getDataValue('level'));
        if (level === user_model_1.UserLevel.SUPERADMIN || level === user_model_1.UserLevel.ADMIN)
            return null;
        const numbersId = user.getDataValue('numbers_id');
        if (!numbersId || numbersId <= 0)
            return null;
        const list = await this.numberListModel.findOne({
            where: { id: numbersId },
            attributes: ['numbers'],
        });
        let blob = list?.getDataValue('numbers');
        if (typeof blob === 'string') {
            try {
                blob = JSON.parse(blob);
            }
            catch {
                blob = null;
            }
        }
        const parsed = (0, cdr_access_scope_1.parseCdrAccessBlob)(blob && typeof blob === 'object' ? blob.cdr : undefined);
        let operatorExtens = parsed.operators;
        if (parsed.operatorUserIds.length > 0) {
            const staff = await this.userModel.findAll({
                where: { uniqueid: parsed.operatorUserIds },
                attributes: ['uniqueid', 'exten', 'login'],
            });
            operatorExtens = staff
                .map((u) => (0, callcenter_access_list_util_1.normalizeAccessToken)(u.getDataValue('exten'))
                || (/^\d+$/.test(String(u.getDataValue('login') || ''))
                    ? String(u.getDataValue('login'))
                    : ''))
                .filter(Boolean);
        }
        const ownExten = (0, callcenter_access_list_util_1.normalizeAccessToken)(user.getDataValue('exten'))
            || (/^\d+$/.test(String(user.getDataValue('login') || ''))
                ? String(user.getDataValue('login'))
                : null);
        return { operators: operatorExtens, queues: parsed.queues, ownExten };
    }
    async accessWhere(vpbxUserUid, viewerUserId) {
        const scope = await this.resolveCdrAccess(viewerUserId);
        if (!scope)
            return null;
        const clause = (0, cdr_access_scope_1.buildCdrLinkedidAccessClause)('c', vpbxUserUid, scope);
        if (!clause)
            return null;
        return { where: clause.sql, replacements: clause.replacements };
    }
    viewerIdFromReq(req) {
        const sub = req?.user?.sub;
        const n = Number(sub);
        return Number.isFinite(n) && n > 0 ? n : undefined;
    }
    async ensureCallVisible(vpbxUserUid, callId, viewerUserId) {
        const access = await this.accessWhere(vpbxUserUid, viewerUserId);
        if (!access)
            return;
        const tenant = (0, cdr_utils_1.tenantLegFilter)(vpbxUserUid);
        const sql = `
      SELECT 1 AS ok
      FROM cdr c
      WHERE ${tenant.sql}
        AND (c.uniqueid = :callId OR c.linkedid = :callId OR c.transid = :callId)
        AND ${access.where}
      LIMIT 1
    `;
        const [row] = await this.sequelize.query(sql, {
            replacements: { ...tenant.replacements, ...access.replacements, callId },
            type: sequelize_2.QueryTypes.SELECT,
        });
        if (!row) {
            throw new common_1.NotFoundException('CDR record not found');
        }
    }
    async applyFilters(vpbxUserUid, filters, viewerUserId) {
        const parts = this.legFilter(vpbxUserUid);
        const clauses = [parts.where];
        const replacements = { ...parts.replacements };
        if (filters.dateFrom) {
            clauses.push('c.calldate >= :dateFrom');
            replacements.dateFrom = filters.dateFrom.length <= 10 ? `${filters.dateFrom} 00:00:00` : filters.dateFrom;
        }
        if (filters.dateTo) {
            clauses.push('c.calldate <= :dateTo');
            replacements.dateTo = filters.dateTo.length <= 10 ? `${filters.dateTo} 23:59:59` : filters.dateTo;
        }
        if (filters.direction === 'in') {
            clauses.push(`(c.dialednum IS NOT NULL AND c.dialednum <> '')`);
        }
        else if (filters.direction === 'out') {
            clauses.push(`c.dcontext LIKE :outCtx`);
            replacements.outCtx = `sip-out${vpbxUserUid}%`;
        }
        else if (filters.direction === 'int') {
            clauses.push(`(CHAR_LENGTH(c.usrc) <= 4 AND CHAR_LENGTH(c.dst) <= 4)`);
        }
        else if (filters.direction === 'external') {
            clauses.push(`(CHAR_LENGTH(c.usrc) > 4 OR CHAR_LENGTH(c.dst) > 4) AND c.lastapp <> 'Queue'`);
        }
        if (filters.disposition === 'answered') {
            clauses.push(`(c.disposition = 'ANSWERED' AND c.dstchannel <> '')`);
        }
        else if (filters.disposition === 'missed') {
            clauses.push(`(c.disposition <> 'ANSWERED' OR c.dstchannel = '')`);
        }
        else if (filters.disposition) {
            clauses.push(`c.disposition = :disposition`);
            replacements.disposition = filters.disposition;
        }
        if (filters.search?.trim()) {
            clauses.push(`(c.usrc LIKE :search OR c.dst LIKE :search OR c.dialednum LIKE :search OR c.channel LIKE :search OR c.dstchannel LIKE :search OR c.disposition LIKE :search)`);
            replacements.search = `%${filters.search.trim()}%`;
        }
        if (filters.extension?.trim()) {
            const ext = filters.extension.trim();
            clauses.push(`(c.usrc = :ext OR c.dst = :ext OR c.channel LIKE :extPat OR c.dstchannel LIKE :extPat)`);
            replacements.ext = ext;
            replacements.extPat = `%e${ext}_${vpbxUserUid}%`;
        }
        if (filters.trunk?.trim()) {
            const trunk = filters.trunk.trim();
            clauses.push(`(c.dialednum = :trunk OR c.channel LIKE :trunkPat OR c.dstchannel LIKE :trunkPat)`);
            replacements.trunk = trunk;
            replacements.trunkPat = `%t_${trunk}_${vpbxUserUid}%`;
        }
        const access = await this.accessWhere(vpbxUserUid, viewerUserId);
        if (access) {
            clauses.push(access.where);
            Object.assign(replacements, access.replacements);
        }
        return { where: clauses.join(' AND '), replacements };
    }
    summarySelect() {
        return `
      c.linkedid AS linkedid,
      MAX(CASE WHEN c.rn_first = 1 THEN c.uniqueid END) AS uniqueid,
      MIN(c.calldate) AS calldate,
      MAX(CASE WHEN c.rn_first = 1 THEN c.clid END) AS clid,
      MAX(CASE WHEN c.rn_first = 1 THEN c.src END) AS src,
      MAX(CASE WHEN c.rn_first = 1 THEN c.usrc END) AS usrc,
      MAX(CASE WHEN c.rn_first = 1 THEN c.channel END) AS channel,
      MAX(CASE WHEN c.rn_last = 1 THEN c.dst END) AS dst,
      MAX(c.dialednum) AS dialednum,
      MAX(CASE WHEN c.rn_last = 1 THEN c.disposition END) AS disposition,
      MAX(CASE WHEN c.rn_last = 1 THEN c.dstchannel END) AS dstchannel,
      SUM(c.duration) AS duration,
      MAX(c.billsec) AS billsec,
      MAX(c.record) AS record,
      MAX(c.transid) AS transid,
      MAX(CASE WHEN c.rn_first = 1 THEN c.dcontext END) AS dcontext,
      COUNT(*) AS leg_count,
      MAX(CASE WHEN c.disposition = 'ANSWERED' AND c.dstchannel <> '' THEN 1 ELSE 0 END) AS answered_flag
    `;
    }
    rankedSource(where) {
        // `calldate` is legacy VARCHAR. ISO-formatted values sort chronologically;
        // NULL is always last and uniqueid resolves equal timestamps on both DBs.
        return `WITH ranked AS (
      SELECT c.*,
        ROW_NUMBER() OVER (PARTITION BY c.linkedid ORDER BY CASE WHEN c.calldate IS NULL THEN 1 ELSE 0 END, c.calldate, c.uniqueid) AS rn_first,
        ROW_NUMBER() OVER (PARTITION BY c.linkedid ORDER BY CASE WHEN c.calldate IS NULL THEN 1 ELSE 0 END, c.calldate DESC, c.uniqueid DESC) AS rn_last
      FROM cdr c WHERE ${where}
    )`;
    }
    bucketHaving(filters) {
        if (!filters.bucket || filters.bucketValue === undefined || filters.bucketValue === '') {
            return { having: '', replacements: {} };
        }
        const v = filters.bucketValue;
        switch (filters.bucket) {
            case 'hour':
                return { having: 'SUBSTRING(MIN(c.calldate), 12, 2) = :bucketVal', replacements: { bucketVal: String(parseInt(v, 10)).padStart(2, '0') } };
            case 'day':
                return { having: 'SUBSTRING(MIN(c.calldate), 1, 10) = :bucketVal', replacements: { bucketVal: v } };
            case 'disposition':
                return {
                    having: 'MAX(CASE WHEN c.rn_last = 1 THEN c.disposition END) = :bucketVal',
                    replacements: { bucketVal: v },
                };
            default:
                return { having: '', replacements: {} };
        }
    }
    async getRecordingBaseUrl() {
        const cfg = await this.systemSettings.getServerConfigRaw();
        const baseUrl = (cfg.records_base_url || '').replace(/\/$/, '');
        const basePath = cfg.records_base_path || '/usr/records';
        return { url: baseUrl, path: basePath };
    }
    /** Same-origin stream path (v3 play.php — file served via API, not RECORDS_BASE_URL). */
    recordingStreamPath(uniqueid) {
        return `/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`;
    }
    safeRecordFilePath(basePath, record) {
        const rel = record.replace(/^\/+/, '').replace(/\\/g, '/');
        if (!rel || rel.includes('..'))
            return null;
        const baseResolved = path.resolve(basePath);
        const fileResolved = path.resolve(baseResolved, `${rel}.mp3`);
        if (!fileResolved.startsWith(baseResolved))
            return null;
        return fs.existsSync(fileResolved) ? fileResolved : null;
    }
    async resolveRecordingFile(vpbxUserUid, uniqueid, viewerUserId) {
        await this.ensureCallVisible(vpbxUserUid, uniqueid, viewerUserId);
        const tenant = (0, cdr_utils_1.tenantLegFilter)(vpbxUserUid);
        const sql = `
      SELECT record, uniqueid
      FROM cdr c
      WHERE ${tenant.sql}
        AND (c.uniqueid = :uniqueid OR c.linkedid = :uniqueid)
      ORDER BY CASE WHEN c.calldate IS NULL THEN 1 ELSE 0 END, c.calldate DESC, c.uniqueid DESC
      LIMIT 1
    `;
        const [row] = await this.sequelize.query(sql, {
            replacements: { ...tenant.replacements, uniqueid },
            type: sequelize_2.QueryTypes.SELECT,
        });
        if (!row?.record) {
            throw new common_1.NotFoundException('Recording not found');
        }
        const { path: basePath } = await this.getRecordingBaseUrl();
        const filePath = this.safeRecordFilePath(basePath, row.record);
        if (!filePath) {
            throw new common_1.NotFoundException('Recording file not found');
        }
        return {
            filePath,
            uniqueid: row.uniqueid,
            record: row.record,
        };
    }
    /** Absolute stream URL (uniqueid often contains ".", so relative "play" breaks). */
    recordingPlayStreamPath(uniqueid, variant) {
        const id = encodeURIComponent(String(uniqueid));
        const prefix = variant === 'public' ? '/api/public/reports/cdr/recording' : '/api/reports/cdr/recording';
        return `${prefix}/${id}/play`;
    }
    /** Minimal HTML player (v3 play.php) — popup opens this page, not raw MP3. */
    renderRecordingPlayerHtml(streamSrc) {
        const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const src = escapeAttr(streamSrc);
        const downloadHref = escapeAttr(streamSrc.includes('?') ? `${streamSrc}&download=1` : `${streamSrc}?download=1`);
        return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Запись звонка</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #111;
      color: #eee;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
        max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }
    .player {
      width: 100%;
      max-width: 520px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    audio {
      width: 100%;
      min-height: 48px;
    }
    .download {
      text-align: center;
      font-size: clamp(13px, 3.5vw, 15px);
    }
    .download a {
      color: #7eb8ff;
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 6px;
      display: inline-block;
    }
    .download a:hover { text-decoration: underline; }
    .download a:focus-visible {
      outline: 2px solid #7eb8ff;
      outline-offset: 2px;
    }
    @media (max-width: 480px) {
      body { padding: 12px; }
      .player { gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="player">
    <audio controls autoplay preload="metadata" src="${src}"></audio>
    <p class="download"><a href="${downloadHref}">Скачать запись</a></p>
  </div>
</body>
</html>`;
    }
    async streamRecording(vpbxUserUid, uniqueid, res, req) {
        const { filePath } = await this.resolveRecordingFile(vpbxUserUid, uniqueid, this.viewerIdFromReq(req));
        let fileSize;
        try {
            fileSize = (await fs.promises.stat(filePath)).size;
        }
        catch {
            throw new common_1.NotFoundException('Recording file not found');
        }
        const download = req?.query?.download === '1' || req?.query?.download === 'true';
        const safeName = String(uniqueid).replace(/[^\w.-]+/g, '_');
        const disposition = download
            ? `attachment; filename="${safeName}.mp3"`
            : 'inline';
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', disposition);
        res.setHeader('Accept-Ranges', 'bytes');
        const rangeHeader = req?.headers?.range;
        if (rangeHeader) {
            const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
            if (!match) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }
            let start;
            let end;
            if (match[1] === '' && match[2]) {
                const suffix = parseInt(match[2], 10);
                start = Math.max(fileSize - suffix, 0);
                end = fileSize - 1;
            }
            else {
                start = match[1] ? parseInt(match[1], 10) : 0;
                end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
            }
            if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }
            end = Math.min(end, fileSize - 1);
            const chunkSize = end - start + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunkSize);
            const stream = fs.createReadStream(filePath, { start, end });
            stream.on('error', () => {
                if (!res.headersSent)
                    res.status(404).end();
            });
            stream.pipe(res);
            return;
        }
        res.setHeader('Content-Length', fileSize);
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            if (!res.headersSent)
                res.status(404).end();
        });
        stream.pipe(res);
    }
    async enrichRows(rows, vpbxUserUid) {
        const { path: basePath } = await this.getRecordingBaseUrl();
        return rows.map((row) => {
            const direction = (0, cdr_utils_1.classifyDirection)(row, vpbxUserUid);
            const srcExt = (0, cdr_utils_1.extractExtension)(row.channel, vpbxUserUid) ||
                (0, cdr_utils_1.extractExtension)(row.usrc, vpbxUserUid) ||
                row.usrc;
            const dstExt = (0, cdr_utils_1.extractExtension)(row.dstchannel, vpbxUserUid) ||
                (0, cdr_utils_1.extractExtension)(row.dst, vpbxUserUid) ||
                row.dst;
            const trunkSlug = (0, cdr_utils_1.extractTrunkSlug)(row.channel, vpbxUserUid) ||
                (0, cdr_utils_1.extractTrunkSlug)(row.dstchannel, vpbxUserUid);
            let srcDisplay = srcExt || row.usrc || row.src || '';
            let dstDisplay = dstExt || row.dst || '';
            if (trunkSlug && direction === 'out') {
                dstDisplay = trunkSlug;
            }
            if (row.dialednum && direction === 'in') {
                dstDisplay = dstDisplay || row.dialednum;
            }
            const record = row.record;
            let recordingUrl = null;
            let hasRecording = false;
            if (record) {
                const filePath = this.safeRecordFilePath(basePath, record);
                if (filePath) {
                    hasRecording = true;
                    recordingUrl = this.recordingStreamPath(row.uniqueid);
                }
            }
            return {
                linkedid: row.linkedid,
                uniqueid: row.uniqueid,
                calldate: row.calldate,
                clid: row.clid,
                src: row.src || row.usrc,
                usrc: row.usrc,
                dst: row.dst,
                dialednum: row.dialednum,
                disposition: row.disposition,
                dstchannel: (0, cdr_utils_1.shortenChannel)(row.dstchannel),
                duration: Number(row.duration) || 0,
                billsec: Number(row.billsec) || 0,
                record,
                transid: row.transid,
                dcontext: row.dcontext,
                legCount: Number(row.leg_count) || 1,
                answered: Number(row.answered_flag) === 1 || (0, cdr_utils_1.isAnswered)(row.disposition, row.dstchannel),
                direction,
                srcDisplay,
                dstDisplay,
                recordingUrl,
                hasRecording,
            };
        });
    }
    async findCalls(vpbxUserUid, filters, viewerUserId) {
        const { where, replacements } = await this.applyFilters(vpbxUserUid, filters, viewerUserId);
        const { having, replacements: havingRepl } = this.bucketHaving(filters);
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const havingClause = having ? `HAVING ${having}` : '';
        const countSql = `
      ${this.rankedSource(where)}
      SELECT COUNT(*) AS cnt FROM (
        SELECT c.linkedid
        FROM ranked c
        GROUP BY c.linkedid
        ${havingClause}
      ) AS grouped
    `;
        const countRows = await this.sequelize.query(countSql, {
            replacements: { ...replacements, ...havingRepl },
            type: sequelize_2.QueryTypes.SELECT,
        });
        const count = Number(countRows[0]?.cnt) || 0;
        const listSql = `
      ${this.rankedSource(where)}
      SELECT ${this.summarySelect()}
      FROM ranked c
      GROUP BY c.linkedid
      ${havingClause}
      ORDER BY CASE WHEN MIN(c.calldate) IS NULL THEN 1 ELSE 0 END, MIN(c.calldate) DESC, c.linkedid DESC
      LIMIT :limit OFFSET :offset
    `;
        const rows = await this.sequelize.query(listSql, {
            replacements: { ...replacements, ...havingRepl, limit, offset },
            type: sequelize_2.QueryTypes.SELECT,
        });
        const enriched = await this.enrichRows(rows, vpbxUserUid);
        return { rows: enriched, count };
    }
    async findLegs(vpbxUserUid, linkedid, viewerUserId) {
        await this.ensureCallVisible(vpbxUserUid, linkedid, viewerUserId);
        const tenant = (0, cdr_utils_1.tenantLegFilter)(vpbxUserUid);
        const sql = `
      SELECT calldate, usrc, src, clid, dst, channel, dstchannel, disposition,
             duration, billsec, uniqueid, transid, record, dcontext, lastapp
      FROM cdr c
      WHERE ${tenant.sql}
        AND c.lastapp <> 'Transferred Call'
        AND (c.linkedid = :linkedid OR c.uniqueid = :linkedid OR c.transid = :linkedid)
      ORDER BY CASE WHEN c.calldate IS NULL THEN 1 ELSE 0 END, c.calldate ASC, c.uniqueid ASC
    `;
        const rows = await this.sequelize.query(sql, {
            replacements: { ...tenant.replacements, linkedid },
            type: sequelize_2.QueryTypes.SELECT,
        });
        return rows.map((row) => ({
            ...row,
            dstchannel: (0, cdr_utils_1.shortenChannel)(row.dstchannel),
            srcDisplay: (0, cdr_utils_1.extractExtension)(row.channel, vpbxUserUid) ||
                (0, cdr_utils_1.extractExtension)(row.usrc, vpbxUserUid) ||
                row.usrc,
            dstDisplay: (0, cdr_utils_1.extractExtension)(row.dstchannel, vpbxUserUid) ||
                (0, cdr_utils_1.extractExtension)(row.dst, vpbxUserUid) ||
                row.dst,
            answered: (0, cdr_utils_1.isAnswered)(row.disposition, row.dstchannel),
        }));
    }
    async getStats(vpbxUserUid, filters, viewerUserId) {
        const { where, replacements } = await this.applyFilters(vpbxUserUid, filters, viewerUserId);
        const sql = `
      SELECT
        COUNT(DISTINCT c.linkedid) AS total_calls,
        SUM(CASE WHEN c.disposition = 'ANSWERED' AND c.dstchannel <> '' THEN 1 ELSE 0 END) AS answered_legs,
        COUNT(*) AS total_legs,
        AVG(c.billsec) AS avg_billsec,
        AVG(CASE WHEN c.disposition = 'ANSWERED' AND c.billsec > 0 THEN c.duration - c.billsec ELSE NULL END) AS avg_pdd
      FROM cdr c
      WHERE ${where}
    `;
        const [row] = await this.sequelize.query(sql, {
            replacements,
            type: sequelize_2.QueryTypes.SELECT,
        });
        const totalCalls = Number(row?.total_calls) || 0;
        const answeredLegs = Number(row?.answered_legs) || 0;
        const totalLegs = Number(row?.total_legs) || 0;
        const dispSql = `
      ${this.rankedSource(where)}
      SELECT disposition, COUNT(DISTINCT linkedid) AS cnt
      FROM (
        SELECT c.linkedid,
          c.disposition
        FROM ranked c
        WHERE c.rn_last = 1
      ) t
      GROUP BY disposition
    `;
        const dispRows = await this.sequelize.query(dispSql, {
            replacements,
            type: sequelize_2.QueryTypes.SELECT,
        });
        const byDisposition = {};
        for (const d of dispRows) {
            byDisposition[d.disposition] = Number(d.cnt);
        }
        return {
            totalCalls,
            asr: totalLegs > 0 ? Math.round((answeredLegs / totalLegs) * 100) : 0,
            avgBillsec: Math.round(Number(row?.avg_billsec) || 0),
            avgPdd: Math.round(Number(row?.avg_pdd) || 0),
            byDisposition,
        };
    }
    async getByHour(vpbxUserUid, filters, viewerUserId) {
        const { where, replacements } = await this.applyFilters(vpbxUserUid, filters, viewerUserId);
        const rows = await this.sequelize.query(`
      SELECT hr AS hour, COUNT(*) AS calls,
        SUM(ans) AS answered,
        COUNT(*) - SUM(ans) AS missed
      FROM (
        SELECT c.linkedid, SUBSTRING(MIN(c.calldate), 12, 2) AS hr,
          MAX(CASE WHEN c.disposition='ANSWERED' AND c.dstchannel<>'' THEN 1 ELSE 0 END) AS ans
        FROM cdr c
        WHERE ${where} AND ${(0, cdr_query_compat_1.validCdrDateSql)(this.sequelize.getDialect())}
        GROUP BY c.linkedid, SUBSTRING(c.calldate, 12, 2)
      ) t
      GROUP BY hr
      ORDER BY hr
    `, { replacements, type: sequelize_2.QueryTypes.SELECT });
        return rows.map(row => ({
            hour: Number(row.hour), calls: Number(row.calls),
            answered: Number(row.answered), missed: Number(row.missed),
        }));
    }
    async getByDay(vpbxUserUid, filters, viewerUserId) {
        const { where, replacements } = await this.applyFilters(vpbxUserUid, filters, viewerUserId);
        const rows = await this.sequelize.query(`
      SELECT day, COUNT(*) AS calls,
        SUM(total_billsec) AS total_billsec,
        ROUND(AVG(avg_billsec)) AS avg_billsec,
        SUM(ans_flag) AS answered,
        COUNT(*) - SUM(ans_flag) AS missed,
        ROUND(100.0 * SUM(ans_flag) / COUNT(*)) AS asr
      FROM (
        SELECT SUBSTRING(MIN(c.calldate), 1, 10) AS day, c.linkedid,
          MAX(c.billsec) AS total_billsec,
          AVG(c.billsec) AS avg_billsec,
          MAX(CASE WHEN c.disposition='ANSWERED' AND c.dstchannel<>'' THEN 1 ELSE 0 END) AS ans_flag
        FROM cdr c
        WHERE ${where} AND ${(0, cdr_query_compat_1.validCdrDateSql)(this.sequelize.getDialect())}
        GROUP BY c.linkedid, SUBSTRING(c.calldate, 1, 10)
      ) t
      GROUP BY day
      ORDER BY day
    `, { replacements, type: sequelize_2.QueryTypes.SELECT });
        return rows.map(row => ({
            day: row.day, calls: Number(row.calls), totalBillsec: Number(row.total_billsec),
            avgBillsec: Number(row.avg_billsec), answered: Number(row.answered),
            missed: Number(row.missed), asr: Number(row.asr),
        }));
    }
    async getByExtension(vpbxUserUid, filters, viewerUserId) {
        const endpoints = await this.endpointModel.findAll({
            where: { tenantid: String(vpbxUserUid) },
            attributes: ['id', 'callerid'],
        });
        const extMap = new Map();
        for (const ep of endpoints) {
            if (ep.id.startsWith('e')) {
                const m = ep.id.match(/^e(.+)_\d+$/);
                if (m)
                    extMap.set(m[1], ep.callerid || m[1]);
            }
        }
        const { where, replacements } = await this.applyFilters(vpbxUserUid, filters, viewerUserId);
        const extLikeSuffix = `_%_${vpbxUserUid}`;
        const rows = await this.sequelize.query(`
      SELECT ext, COUNT(*) AS total,
        SUM(inbound) AS inbound,
        SUM(outbound) AS outbound,
        SUM(answered) AS answered
      FROM (
        SELECT
          CASE
            WHEN CHAR_LENGTH(c.usrc) <= 4 THEN c.usrc
            WHEN c.usrc LIKE CONCAT('e%', :extLikeSuffix) THEN SUBSTRING(c.usrc, 2, POSITION('_' IN c.usrc) - 2)
            ELSE NULL
          END AS ext,
          CASE WHEN c.dialednum <> '' AND c.dialednum IS NOT NULL THEN 1 ELSE 0 END AS inbound,
          CASE WHEN c.dcontext LIKE :outCtx THEN 1 ELSE 0 END AS outbound,
          CASE WHEN c.disposition='ANSWERED' AND c.dstchannel<>'' THEN 1 ELSE 0 END AS answered
        FROM cdr c
        WHERE ${where}
      ) legs
      WHERE ext IS NOT NULL
      GROUP BY ext
      ORDER BY total DESC
      LIMIT 20
    `, {
            replacements: { ...replacements, outCtx: `sip-out${vpbxUserUid}%`, extLikeSuffix },
            type: sequelize_2.QueryTypes.SELECT,
        });
        return rows.map((r) => ({
            extension: r.ext,
            displayName: extMap.get(r.ext) || r.ext,
            total: Number(r.total),
            inbound: Number(r.inbound),
            outbound: Number(r.outbound),
            answered: Number(r.answered),
            asr: Number(r.total) > 0 ? Math.round((Number(r.answered) / Number(r.total)) * 100) : 0,
        }));
    }
    async getByTrunk(vpbxUserUid, filters, viewerUserId) {
        const { where, replacements } = await this.applyFilters(vpbxUserUid, filters, viewerUserId);
        const rows = await this.sequelize.query(`
      SELECT COALESCE(dialednum, 'unknown') AS trunk,
        COUNT(DISTINCT linkedid) AS calls,
        SUM(billsec) AS total_billsec
      FROM (
        SELECT c.linkedid, MAX(c.dialednum) AS dialednum, MAX(c.billsec) AS billsec
        FROM cdr c
        WHERE ${where} AND c.dialednum IS NOT NULL AND c.dialednum <> ''
        GROUP BY c.linkedid
      ) t
      GROUP BY trunk
      ORDER BY calls DESC
      LIMIT 20
    `, { replacements, type: sequelize_2.QueryTypes.SELECT });
        return rows.map(row => ({
            trunk: row.trunk, calls: Number(row.calls), totalBillsec: Number(row.total_billsec),
        }));
    }
    async getByDisposition(vpbxUserUid, filters, viewerUserId) {
        const stats = await this.getStats(vpbxUserUid, filters, viewerUserId);
        return Object.entries(stats.byDisposition).map(([disposition, count]) => ({
            disposition,
            count,
        }));
    }
    async getHeatmap(vpbxUserUid, filters, viewerUserId) {
        const { where, replacements } = await this.applyFilters(vpbxUserUid, filters, viewerUserId);
        const rows = await this.sequelize.query(`
      SELECT SUBSTRING(MIN(c.calldate), 1, 10) AS day,
        SUBSTRING(MIN(c.calldate), 12, 2) AS hour,
        1 AS calls
      FROM cdr c
      WHERE ${where} AND ${(0, cdr_query_compat_1.validCdrDateSql)(this.sequelize.getDialect())}
      GROUP BY c.linkedid, SUBSTRING(c.calldate, 1, 10), SUBSTRING(c.calldate, 12, 2)
    `, { replacements, type: sequelize_2.QueryTypes.SELECT });
        const matrix = {};
        for (const r of rows) {
            const day = new Date(`${r.day}T00:00:00Z`);
            if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== r.day)
                continue;
            const key = `${day.getUTCDay() + 1}-${Number(r.hour)}`;
            matrix[key] = (matrix[key] || 0) + Number(r.calls);
        }
        const result = [];
        for (const [key, calls] of Object.entries(matrix)) {
            const [dow, hour] = key.split('-').map(Number);
            result.push({ dow, hour, calls });
        }
        return result;
    }
    async findByUniqueid(vpbxUserUid, uniqueid, viewerUserId) {
        await this.ensureCallVisible(vpbxUserUid, uniqueid, viewerUserId);
        const tenant = (0, cdr_utils_1.tenantLegFilter)(vpbxUserUid);
        const sql = `
      SELECT record, uniqueid, linkedid, userfield
      FROM cdr c
      WHERE ${tenant.sql}
        AND (c.uniqueid = :uniqueid OR c.linkedid = :uniqueid)
      ORDER BY CASE WHEN c.calldate IS NULL THEN 1 ELSE 0 END, c.calldate DESC, c.uniqueid DESC
      LIMIT 1
    `;
        const [row] = await this.sequelize.query(sql, {
            replacements: { ...tenant.replacements, uniqueid },
            type: sequelize_2.QueryTypes.SELECT,
        });
        if (!row) {
            throw new common_1.NotFoundException('CDR record not found');
        }
        const { path: basePath } = await this.getRecordingBaseUrl();
        const record = row.record;
        let recordingUrl = null;
        let exists = false;
        if (record) {
            const filePath = this.safeRecordFilePath(basePath, record);
            exists = Boolean(filePath);
            if (exists) {
                recordingUrl = this.recordingStreamPath(row.uniqueid);
            }
        }
        return { record, uniqueid: row.uniqueid, linkedid: row.linkedid, recordingUrl, exists };
    }
    async exportCalls(vpbxUserUid, filters, viewerUserId) {
        const result = await this.findCalls(vpbxUserUid, {
            ...filters,
            limit: 10000,
            offset: 0,
        }, viewerUserId);
        return result.rows;
    }
};
exports.CdrService = CdrService;
exports.CdrService = CdrService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(cdr_model_1.Cdr)),
    __param(1, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __param(2, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(3, (0, sequelize_1.InjectModel)(number_list_model_1.NumberList)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, sequelize_typescript_1.Sequelize,
        system_settings_service_1.SystemSettingsService])
], CdrService);
//# sourceMappingURL=cdr.service.js.map