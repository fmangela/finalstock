const router = require('express').Router();
const { SystemConfig } = require('../models');
const scheduler = require('../services/scheduler');

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

// 重新加载新闻同步调度（保存同步配置后调用）
router.post('/reload-sync', async (req, res) => {
  try {
    await scheduler.reloadNewsSyncSchedule();
    res.json({ code: 0, message: '调度已重新加载' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

module.exports = router;
