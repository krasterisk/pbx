"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimStage = claimStage;
exports.startStageExecution = startStageExecution;
exports.commitStage = commitStage;
const state_machines_1 = require("./state-machines");
function claimStage(stage, input) {
    if (input.owner.length < 8) {
        throw new Error('lease owner must not be an OS PID');
    }
    const version = (0, state_machines_1.compareAndSwapVersion)(stage.version, input.expectedVersion);
    const nextState = stage.state === 'pending' ? (0, state_machines_1.transitionStage)('pending', 'leased') : stage.state;
    if (nextState !== 'leased' && nextState !== 'pending') {
        throw new Error(`stage ${stage.state} is not claimable`);
    }
    if (stage.state === 'leased' && stage.leaseUntil && stage.leaseUntil > input.now && stage.leaseOwner !== input.owner) {
        throw new Error('stage lease is held');
    }
    return {
        ...stage,
        state: 'leased',
        version,
        fence: stage.fence + 1,
        leaseOwner: input.owner,
        leaseUntil: new Date(input.now.getTime() + input.leaseMs),
    };
}
function startStageExecution(stage, input) {
    if (stage.leaseOwner !== input.owner || stage.fence !== input.fence) {
        throw Object.assign(new Error('stale fence'), { code: 'stale_fence' });
    }
    return { ...stage, state: (0, state_machines_1.transitionStage)(stage.state, 'executing') };
}
function commitStage(stage, input) {
    if (stage.leaseOwner !== input.owner || stage.fence !== input.fence) {
        throw Object.assign(new Error('stale fence'), { code: 'stale_fence' });
    }
    return {
        ...stage,
        state: (0, state_machines_1.transitionStage)(stage.state, input.to),
        leaseOwner: null,
        leaseUntil: null,
    };
}
//# sourceMappingURL=stage-lease.js.map