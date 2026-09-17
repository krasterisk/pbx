#!/usr/bin/env python3
"""Surgical live-backend patch: Already-there, AMI-merge, reconcile."""
from pathlib import Path

SVC = Path("/var/www/pbx/packages/backend/src/modules/callcenter/callcenter.service.ts")
AMI = Path("/var/www/pbx/packages/backend/src/modules/callcenter/callcenter-ami.service.ts")
CTL = Path("/var/www/pbx/packages/backend/src/modules/callcenter/callcenter.controller.ts")

ADD_OLD = """    try {
      await this.amiService.queueAdd(queue, agentInterface, penalty);
    } catch (err: any) {
      throw new BadRequestException(`Failed to add to queue: ${err.message}`);
    }

    const agent = this.stateService.getAgent(userUid, agentInterface)
      || this.stateService.getAllAgentsGlobal().find((a) => a.interface === agentInterface);
    if (agent) {
      const queues = agent.queues.includes(queue) ? agent.queues : [...agent.queues, queue];
      this.stateService.setAgent(agent.userUid, agent.interface, {
        queues,
        queuesDetached: false,
      });
    }

    // State will be updated by AMI QueueMemberAdded event
    this.logger.log(`Supervisor added ${agentInterface} to queue ${queue}`);
    return { success: true };
  }"""

ADD_NEW = """    try {
      await this.amiService.queueAdd(queue, agentInterface, penalty);
    } catch (err: any) {
      const msg = String(err?.message || err?.Message || '');
      if (!/already there/i.test(msg) && !/already a member/i.test(msg)) {
        throw new BadRequestException(`Failed to add to queue: ${msg || err}`);
      }
    }

    const agent = this.stateService.getAgent(userUid, agentInterface)
      || this.stateService.getAllAgentsGlobal().find((a) => a.interface === agentInterface);
    const previous = agent?.queues ?? [];
    const queues = previous.includes(queue) ? previous : [...previous, queue];
    if (agent) {
      this.stateService.setAgent(agent.userUid, agent.interface, {
        queues,
        queuesDetached: false,
      });
      if ((agent.userId ?? 0) > 0) {
        try {
          const session = await this.sessionModel.findOne({
            where: { user_id: agent.userId, logout_time: null },
            order: [['login_time', 'DESC']],
          });
          if (session) {
            const snap = (session.getDataValue('queues_snapshot') as string[] | null) || [];
            const base = snap.length ? snap : previous;
            const next = base.includes(queue) ? base : [...base, queue];
            await session.update({ queues_snapshot: next });
          }
        } catch { /* ignore */ }
      }
    }

    this.logger.log(`Supervisor added ${agentInterface} to queue ${queue}`);
    const after = agent
      ? this.stateService.getAgent(agent.userUid, agent.interface)
      : null;
    return { success: true, queues: after?.queues ?? queues };
  }

  async supervisorReconcileQueues(userUid: number, agentInterface?: string) {
    await this.ccAmiService.resyncMembershipFromAsterisk();
    if (!agentInterface) return { success: true as const };
    const agent = this.stateService.getAgent(userUid, agentInterface)
      || this.stateService.getAllAgentsGlobal().find((a) => a.interface === agentInterface);
    return {
      success: true as const,
      interface: agent?.interface || agentInterface,
      queues: agent?.queues ?? [],
    };
  }"""

REMOVE_OLD = """    this.logger.log(`Supervisor removed ${agentInterface} from queue ${queue}`);
    return { success: true };
  }"""

REMOVE_NEW = """    this.logger.log(`Supervisor removed ${agentInterface} from queue ${queue}`);
    const after = agent
      ? this.stateService.getAgent(agent.userUid, agent.interface)
      : null;
    return { success: true, queues: after?.queues ?? [] };
  }"""

CTL_OLD = """  @Post('supervisor/queue-add')
  supervisorQueueAdd(@Body() dto: SupervisorQueueActionDto, @Req() req: Request & { user: any }) {"""

CTL_NEW = """  @Post('supervisor/reconcile-queues')
  supervisorReconcileQueues(
    @Body() dto: { agentInterface?: string },
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.ccService.supervisorReconcileQueues(req.user.vpbx_user_uid, dto?.agentInterface);
  }

  @Post('supervisor/queue-add')
  supervisorQueueAdd(@Body() dto: SupervisorQueueActionDto, @Req() req: Request & { user: any }) {"""

AMI_OLD = """    const liveQueues = this.liveQueuesForAgent(userUid, agentIface, liveByAgent);
    const missing = desired.filter((q) => !liveQueues.has(q));"""

AMI_NEW = """    const liveQueues = this.liveQueuesForAgent(userUid, agentIface, liveByAgent);
    const merged = Array.from(new Set([...desired, ...liveQueues]));
    const missing = desired.filter((q) => !liveQueues.has(q));"""


def patch_file(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new.strip() in text and old not in text:
        print(f"OK already: {label}")
        return
    if old not in text:
        raise SystemExit(f"MISSING marker: {label} in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched: {label}")


def patch_ami_desired(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    start = text.find("  private async ensureSessionQueuesInAsterisk(")
    end = text.find("  /** Push QueuePause to match panel READY / PAUSED / OUTBOUND_WORK. */")
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("MISSING ensureSessionQueuesInAsterisk block")
    block = text[start:end]
    if "const merged = Array.from(new Set([...desired, ...liveQueues]));" in block:
        print("OK already: ami-merge")
        return
    if AMI_OLD not in block:
        raise SystemExit("MISSING liveQueues/missing in ensureSessionQueues")
    block = block.replace(AMI_OLD, AMI_NEW, 1)
    # Only rewrite RAM snapshots inside this function — keep QueuePause loop on desired.
    block = block.replace("agent.queues?.join() !== desired.join()", "agent.queues?.join() !== merged.join()")
    block = block.replace("queues: desired,", "queues: merged,")
    block = block.replace("    for (const q of desired) set.add(q);", "    for (const q of merged) set.add(q);")
    leftover = [ln for ln in block.splitlines() if "queues: desired" in ln]
    if leftover:
        raise SystemExit("still has queues: desired after merge patch: " + repr(leftover))
    path.write_text(text[:start] + block + text[end:], encoding="utf-8")
    print("patched: ami-merge")


def main() -> None:
    for p in (SVC, AMI, CTL):
        bak = Path(str(p) + ".bak-queue-20260916")
        if not bak.exists():
            bak.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
            print(f"backup: {bak}")
    patch_file(SVC, ADD_OLD, ADD_NEW, "supervisorQueueAdd+reconcile")
    patch_file(SVC, REMOVE_OLD, REMOVE_NEW, "supervisorQueueRemove queues")
    patch_file(CTL, CTL_OLD, CTL_NEW, "reconcile-queues route")
    patch_ami_desired(AMI)
    print("DONE")


if __name__ == "__main__":
    main()
