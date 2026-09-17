from pathlib import Path

SVC = Path("/var/www/pbx/packages/backend/src/modules/callcenter/callcenter.service.ts")
AMI = Path("/var/www/pbx/packages/backend/src/modules/callcenter/callcenter-ami.service.ts")

OLD = """  async supervisorQueueRemove(agentInterface: string, queue: string, userUid: number) {
    const ifaces = CallCenterService.relatedQueueInterfaces(agentInterface);
    let removedSomewhere = false;"""

NEW = """  async supervisorQueueRemove(agentInterface: string, queue: string, userUid: number) {
    const ifaces = CallCenterService.relatedQueueInterfaces(agentInterface);
    try {
      const sequelize = this.queueModel?.sequelize;
      if (sequelize) {
        await sequelize.query(
          'DELETE FROM queue_members_table WHERE queue_name = :queue AND interface IN (:ifaces)',
          { replacements: { queue, ifaces } },
        );
      }
    } catch { /* ignore */ }
    let removedSomewhere = false;"""

text = SVC.read_text(encoding="utf-8")
if "DELETE FROM queue_members_table" in text:
    print("OK already: realtime purge")
else:
    if OLD not in text:
        raise SystemExit("MISSING supervisorQueueRemove start")
    SVC.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
    print("patched: realtime purge")

ami = AMI.read_text(encoding="utf-8")
old_sleep = "await new Promise(resolve => setTimeout(resolve, 1200));"
new_sleep = "await new Promise(resolve => setTimeout(resolve, 3500));"
if new_sleep in ami:
    print("OK already: resync wait")
elif old_sleep in ami:
    AMI.write_text(ami.replace(old_sleep, new_sleep, 1), encoding="utf-8")
    print("patched: resync wait 3500")
else:
    print("WARN: resync sleep marker missing")
