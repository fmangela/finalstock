// 系统配置路由
// 所有配置项统一存储在 system_configs 表，按 config_group + config_key 分组
const router = require('express').Router();
const { SystemConfig } = require('../models');
const scheduler = require('../services/scheduler');

// 获取全部配置，按分组聚合为嵌套对象返回
// 返回格式：{ news: { sync_enabled: '1', ... }, llm_config: { ... } }
router.get('/all', async (req, res) => {
  try {
    const configs = await SystemConfig.findAll();
    const result = {};
    for (const c of configs) {
      if (!result[c.config_group]) result[c.config_group] = {};
      result[c.config_group][c.config_key] = c.config_value;
    }
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 保存单条配置（不存在则创建，已存在则更新）
router.post('/save', async (req, res) => {
  try {
    const { config_group, config_key, config_value } = req.body;
    const [record, created] = await SystemConfig.findOrCreate({
      where: { config_group, config_key },
      defaults: { config_value }
    });
    if (!created) await record.update({ config_value });
    res.json({ code: 0, data: record });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 查询调度器当前任务状态
router.get('/scheduler/status', (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json({ code: 0, data: status });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 重新加载新闻同步调度（前端修改同步频率后调用，立即生效）
router.post('/reload-sync', async (req, res) => {
  try {
    await scheduler.reloadNewsSyncSchedule();
    res.json({ code: 0, message: '调度已重新加载' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

module.exports = router;
