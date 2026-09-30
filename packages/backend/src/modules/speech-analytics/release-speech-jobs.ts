import { Op, type Transaction } from 'sequelize';
import { AiJobAdmissionService } from '../ai-jobs/ai-job-admission.service';
import { SaAnalysisRun } from './speech-analytics.models';

/** null means the job is still in flight and must keep its fairness slot. */
export function speechJobSettlement(runState: string | undefined): 'succeeded' | 'failed' | null {
  if (runState === 'queued' || runState === 'running') return null;
  if (runState === 'completed' || runState === 'succeeded') return 'succeeded';
  return 'failed';
}

/** Drop finished speech-analytics jobs out of the tenant fairness cap before a new admit. */
export async function releaseFinishedSpeechJobs(
  tenantUid: number,
  runs: typeof SaAnalysisRun,
  admission: AiJobAdmissionService,
  transaction?: Transaction,
): Promise<void> {
  const jobIds = await admission.openSpeechJobIds(tenantUid, transaction);
  if (jobIds.length === 0) return;
  const runRows = await runs.findAll({
    where: { tenant_uid: tenantUid, job_id: { [Op.in]: jobIds } },
    transaction,
  });
  const stateByJob = new Map(runRows.map((run) => [run.job_id, run.state]));
  for (const jobId of jobIds) {
    const outcome = speechJobSettlement(stateByJob.get(jobId));
    if (!outcome) continue;
    await admission.settle(tenantUid, jobId, outcome, transaction);
  }
}
