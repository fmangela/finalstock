const router = require('express').Router();
const { AppLog, SystemConfig } = require('../models');

// 获取日志配置
router.get('/config', async (req, res) => {
  try {
    const configs = await SystemConfig.findAll({ where: { config_group: 'logging' } });
    const result = {};
    configs.forEach(c => { result[c.config_key] = c.config_value; });
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 保存日志配置
router.post('/config', async (req, res) => {
  try {
    const { enabled } = req.body;
    const value = enabled ? '1' : '0';
    
    await SystemConfig.findOrCreate({
      where: { config_group: 'logging', config_key: 'enabled' },
      defaults: { config_value: value }
    }).then(([record]) => {
      if (!record.isNewRecord) record.update({ config_value: value });
    });
    
    res.json({ code: 0, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 获取日志列表
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 100, level } = req.query;
    const where = {};
    if (level && level !== 'all') {
      where.level = level;
    }
    
    const { count, rows } = await AppLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });
    
    res.json({ code: 0, data: { list: rows, total: count } });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 清空日志
router.delete('/clear', async (req, res) => {
  try {
    await AppLog.destroy({ where: {} });
    res.json({ code: 0, message: '日志已清空' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

module.exports = router;