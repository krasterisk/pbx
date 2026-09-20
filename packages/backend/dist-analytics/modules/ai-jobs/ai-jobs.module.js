"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiJobsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_job_models_1 = require("./ai-job.models");
const ai_job_admission_service_1 = require("./ai-job-admission.service");
const ai_outbox_dispatcher_service_1 = require("./ai-outbox-dispatcher.service");
const ai_stage_lease_service_1 = require("./ai-stage-lease.service");
/** Durable job/outbox runtime. HTTP analysis remains AI-04. Not imported by AppModule. */
let AiJobsModule = class AiJobsModule {
};
exports.AiJobsModule = AiJobsModule;
exports.AiJobsModule = AiJobsModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([
                ai_job_models_1.AiIdempotency, ai_job_models_1.AiJob, ai_job_models_1.AiJobStage, ai_job_models_1.AiProviderOperation, ai_job_models_1.AiOutbox, ai_job_models_1.AiJobEvent,
            ])],
        providers: [ai_job_admission_service_1.AiJobAdmissionService, ai_stage_lease_service_1.AiStageLeaseService, ai_outbox_dispatcher_service_1.AiOutboxDispatcherService],
        exports: [
            sequelize_1.SequelizeModule, ai_job_admission_service_1.AiJobAdmissionService, ai_stage_lease_service_1.AiStageLeaseService, ai_outbox_dispatcher_service_1.AiOutboxDispatcherService,
        ],
    })
], AiJobsModule);
//# sourceMappingURL=ai-jobs.module.js.map