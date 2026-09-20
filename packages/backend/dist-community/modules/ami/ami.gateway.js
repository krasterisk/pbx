"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AmiGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmiGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
let AmiGateway = AmiGateway_1 = class AmiGateway {
    logger = new common_1.Logger(AmiGateway_1.name);
    server;
    emitPeerStatus(data) {
        this.server?.emit('peerStatus', data);
    }
    emitAgentStatus(data) {
        this.server?.emit('agentStatus', data);
    }
    emitNewChannel(data) {
        this.server?.emit('newChannel', data);
    }
    emitHangup(data) {
        this.server?.emit('hangup', data);
    }
    emitDashboardUpdate(data) {
        this.server?.emit('dashboardUpdate', data);
    }
};
exports.AmiGateway = AmiGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AmiGateway.prototype, "server", void 0);
exports.AmiGateway = AmiGateway = AmiGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        namespace: '/ami-events',
    })
], AmiGateway);
//# sourceMappingURL=ami.gateway.js.map