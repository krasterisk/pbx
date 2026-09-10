import { Op } from 'sequelize';
import { PbxWorkflowRunnerService } from './pbx-workflow-runner.service';

const CTX = { vpbxUserUid: 42, userUid: 7, role: 1 };

function workflowRow(partial: Record<string, unknown>) {
  return {
    uid: 1,
    workflow_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    thread_uid: 7,
    title: 'IVR',
    summary: ['Create menu'],
    status: 'pending',
    error: null,
    expires_at: new Date('2027-01-01T00:00:00Z'),
    applied_at: null,
    ...partial,
  };
}

describe('PbxWorkflowRunnerService pending inbox', () => {
  const workflowModel = { findAll: jest.fn(), findOne: jest.fn(), destroy: jest.fn(), update: jest.fn() };
  const stepModel = { findAll: jest.fn(), destroy: jest.fn() };
  const threadModel = { findAll: jest.fn() };
  let service: PbxWorkflowRunnerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PbxWorkflowRunnerService(
      workflowModel as any,
      stepModel as any,
      {} as any,
      {} as any,
      {} as any,
      threadModel as any,
    );
  });

  it('lists only workflows whose conversation still exists and includes threadUid', async () => {
    workflowModel.findAll.mockResolvedValue([
      workflowRow({ uid: 1, thread_uid: 7, title: 'Living' }),
      workflowRow({ uid: 2, thread_uid: 99, title: 'Orphan', workflow_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    ]);
    threadModel.findAll.mockResolvedValue([{ uid: 7 }]);
    stepModel.findAll.mockResolvedValue([]);

    const views = await service.listPending(CTX);

    expect(threadModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          uid: { [Op.in]: [7, 99] },
          vpbx_user_uid: 42,
          user_uid: 7,
        }),
      }),
    );
    expect(views).toHaveLength(1);
    expect(views[0].title).toBe('Living');
    expect(views[0].threadUid).toBe(7);
    expect(stepModel.destroy).toHaveBeenCalledWith({
      where: { workflow_uid: { [Op.in]: [2] } },
    });
    expect(workflowModel.destroy).toHaveBeenCalledWith({
      where: { uid: { [Op.in]: [2] } },
    });
  });

  it('deletes steps and workflows for one owned conversation', async () => {
    workflowModel.findAll.mockResolvedValue([
      workflowRow({ uid: 3, thread_uid: 7 }),
      workflowRow({ uid: 4, thread_uid: 7, workflow_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
    ]);
    stepModel.destroy.mockResolvedValue(2);
    workflowModel.destroy.mockResolvedValue(2);

    await service.deleteForThread(7, CTX);

    expect(workflowModel.findAll).toHaveBeenCalledWith({
      where: { thread_uid: 7, vpbx_user_uid: 42, user_uid: 7 },
    });
    expect(stepModel.destroy).toHaveBeenCalledWith({
      where: { workflow_uid: { [Op.in]: [3, 4] } },
    });
    expect(workflowModel.destroy).toHaveBeenCalledWith({
      where: { uid: { [Op.in]: [3, 4] } },
    });
  });

  it('returns the latest pending workflow for a conversation', async () => {
    workflowModel.findOne.mockResolvedValue(workflowRow({ uid: 9, thread_uid: 7 }));
    stepModel.findAll.mockResolvedValue([]);

    const view = await service.findLatestPendingForThread(7, CTX);

    expect(view?.threadUid).toBe(7);
    expect(workflowModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ thread_uid: 7, status: { [Op.in]: ['pending', 'failed'] } }),
    }));
  });
});
