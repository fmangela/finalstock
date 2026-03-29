// 自动回测后台任务服务
// 目标：将重型回测流程从 HTTP 请求中剥离出来，并提供进度查询能力
const { randomUUID } = require('crypto');

const MAX_HISTORY = 20;
const tasks = new Map();
let activeTaskId = null;
let latestTaskId = null;

function nowIso() {
  return new Date().toISOString();
}

function cloneTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    meta: task.meta,
    progress: { ...task.progress },
    result: task.result,
    error: task.error,
    created_at: task.created_at,
    started_at: task.started_at,
    finished_at: task.finished_at,
    updated_at: task.updated_at
  };
}

function trimHistory() {
  const completed = Array.from(tasks.values())
    .filter(task => task.status !== 'queued' && task.status !== 'running')
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  for (const task of completed.slice(MAX_HISTORY)) {
    tasks.delete(task.id);
  }
}

function setTaskProgress(task, patch = {}) {
  task.progress = {
    ...task.progress,
    ...patch
  };
  task.updated_at = nowIso();
}

function getTaskInternal(id) {
  return id ? tasks.get(id) || null : null;
}

function getTask(id) {
  return cloneTask(getTaskInternal(id));
}

function getActiveTask() {
  return cloneTask(getTaskInternal(activeTaskId));
}

function getLatestTask() {
  return cloneTask(getTaskInternal(latestTaskId));
}

async function waitForTask(id) {
  const task = getTaskInternal(id);
  if (!task) return null;
  await task.completion;
  return cloneTask(task);
}

function startTask(type, runner, meta = {}) {
  const existing = getTaskInternal(activeTaskId);
  if (existing) {
    return {
      started: false,
      task: cloneTask(existing),
      completion: existing.completion
    };
  }

  const id = typeof randomUUID === 'function'
    ? randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const task = {
    id,
    type,
    status: 'queued',
    meta,
    progress: {
      current: 0,
      total: 0,
      message: '等待执行'
    },
    result: null,
    error: null,
    created_at: nowIso(),
    started_at: null,
    finished_at: null,
    updated_at: nowIso(),
    completion: null
  };

  let resolveCompletion;
  task.completion = new Promise(resolve => {
    resolveCompletion = resolve;
  });

  tasks.set(id, task);
  activeTaskId = id;
  latestTaskId = id;

  setImmediate(async () => {
    task.status = 'running';
    task.started_at = nowIso();
    task.updated_at = task.started_at;

    try {
      const result = await runner((patch) => setTaskProgress(task, patch));
      task.status = 'success';
      task.result = result;
      setTaskProgress(task, {
        current: task.progress.total || task.progress.current || 0,
        total: task.progress.total || task.progress.current || 0,
        message: '执行完成'
      });
    } catch (e) {
      task.status = 'failed';
      task.error = e.message;
      setTaskProgress(task, {
        message: e.message || '执行失败'
      });
    } finally {
      task.finished_at = nowIso();
      task.updated_at = task.finished_at;
      if (activeTaskId === id) {
        activeTaskId = null;
      }
      trimHistory();
      resolveCompletion();
    }
  });

  return {
    started: true,
    task: cloneTask(task),
    completion: task.completion
  };
}

module.exports = {
  getTask,
  getActiveTask,
  getLatestTask,
  waitForTask,
  startTask
};
