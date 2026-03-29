// 自动回测后台任务服务测试
// 验证后台任务的生命周期和“运行中复用当前任务”行为

describe('backtestTaskService', () => {
  let backtestTaskService;

  beforeEach(() => {
    jest.resetModules();
    backtestTaskService = require('../src/services/backtestTaskService');
  });

  it('可以启动任务并在完成后保存结果', async () => {
    const { started, task, completion } = backtestTaskService.startTask(
      'auto-backtest',
      async (reportProgress) => {
        reportProgress({ current: 1, total: 2, message: '处理中' });
        return { ran: 3, skipped: 1, failed: 0, deleted: 0 };
      }
    );

    expect(started).toBe(true);
    expect(task.status).toBe('queued');

    await completion;

    const finishedTask = backtestTaskService.getTask(task.id);
    expect(finishedTask.status).toBe('success');
    expect(finishedTask.result).toEqual({ ran: 3, skipped: 1, failed: 0, deleted: 0 });
    expect(finishedTask.progress.current).toBe(2);
    expect(finishedTask.progress.total).toBe(2);
  });

  it('已有运行中任务时会复用当前任务而不是重复启动', async () => {
    let releaseTask;
    const blocker = new Promise(resolve => {
      releaseTask = resolve;
    });

    const first = backtestTaskService.startTask(
      'auto-backtest',
      async (reportProgress) => {
        reportProgress({ current: 0, total: 1, message: '执行中' });
        await blocker;
        return { ran: 1, skipped: 0, failed: 0, deleted: 0 };
      }
    );

    const second = backtestTaskService.startTask(
      'auto-backtest',
      async () => ({ ran: 99, skipped: 0, failed: 0, deleted: 0 })
    );

    expect(second.started).toBe(false);
    expect(second.task.id).toBe(first.task.id);

    releaseTask();
    await first.completion;

    const finishedTask = backtestTaskService.getTask(first.task.id);
    expect(finishedTask.status).toBe('success');
    expect(finishedTask.result.ran).toBe(1);
  });
});
