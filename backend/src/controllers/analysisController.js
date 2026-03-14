// 每日市场指导控制器
// 每个交易日对应一条记录（trade_date 唯一），保存/更新时用 findOrCreate 避免重复
const { DailyGuidance } = require('../models');

// 获取今日市场指导（按当前日期查询，无记录时返回 null）
exports.getToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // 格式：YYYY-MM-DD
    const guidance = await DailyGuidance.findOne({ where: { trade_date: today } });
    res.json({ code: 0, data: guidance });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 保存或更新指定日期的市场指导
// 同一天多次保存时更新已有记录，不新增
exports.save = async (req, res) => {
  try {
    const { trade_date, market_overall, guidance, risk_level, key_stocks, analysis_summary } = req.body;
    const [record, created] = await DailyGuidance.findOrCreate({
      where: { trade_date },
      defaults: { market_overall, guidance, risk_level, key_stocks, analysis_summary }
    });
    if (!created) {
      // 已存在则更新内容
      await record.update({ market_overall, guidance, risk_level, key_stocks, analysis_summary });
    }
    res.json({ code: 0, data: record });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
