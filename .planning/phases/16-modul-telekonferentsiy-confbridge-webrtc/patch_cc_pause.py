from pathlib import Path

p = Path("/var/www/pbx/packages/backend/src/modules/callcenter/callcenter.service.ts")
text = p.read_text(encoding="utf-8")
old = """    for (const q of agent.queues) {
      try {
        await this.amiService.queuePause(q, agentInterface, true, reason || 'Forced by supervisor');
      } catch { /* ignore */ }
    }

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'PAUSED',
      pauseReason: reason || 'Forced by supervisor',
      statusOrigin: 'manual',
    });

    const paused = this.stateService.getAgent(userUid, agentInterface);
    if (paused) {
      await this.ccAmiService.beginTimedStatus(
        paused,
        'PAUSE',
        reason || 'Forced by supervisor',
      );
    }"""
new = """    const pauseReason = (reason ?? '').trim();

    for (const q of agent.queues) {
      try {
        await this.amiService.queuePause(q, agentInterface, true, pauseReason || undefined);
      } catch { /* ignore */ }
    }

    this.stateService.setAgent(userUid, agentInterface, {
      status: 'PAUSED',
      pauseReason,
      statusOrigin: 'manual',
    });

    const paused = this.stateService.getAgent(userUid, agentInterface);
    if (paused) {
      await this.ccAmiService.beginTimedStatus(paused, 'PAUSE', pauseReason);
    }"""
if "const pauseReason = (reason ?? '').trim();" in text and "Forced by supervisor" not in text:
    print("OK already: supervisor pause reason")
elif old not in text:
    raise SystemExit("MISSING supervisorForcePause body")
else:
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("patched: supervisor pause reason")
