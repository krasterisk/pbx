from pathlib import Path

p = Path("/var/www/pbx/packages/backend/src/modules/callcenter/callcenter.controller.ts")
t = p.read_text(encoding="utf-8")
dup = """  @Post('supervisor/reconcile-queues')
  supervisorReconcileQueues(
    @Body() dto: { agentInterface?: string },
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.ccService.supervisorReconcileQueues(req.user.vpbx_user_uid, dto?.agentInterface);
  }

"""
count = t.count(dup)
if count < 2:
    raise SystemExit(f"expected 2 reconcile blocks, got {count}")
p.write_text(t.replace(dup, "", 1), encoding="utf-8")
left = p.read_text(encoding="utf-8").count("@Post('supervisor/reconcile-queues')")
print(f"removed duplicate, remaining routes={left}")
