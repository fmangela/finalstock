const { DailyGuidance } = require('../models');

exports.getToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const guidance = await DailyGuidance.findOne({ where: { trade_date: today } });
    res.json({ code: 0, data: guidance });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.save = async (req, res) => {
  try {
    const { trade_date, market_overall, guidance, risk_level, key_stocks, analysis_summary } = req.body;
    const [record, created] = await DailyGuidance.findOrCreate({
      where: { trade_date },
      defaults: { market_overall, guidance, risk_level, key_stocks, analysis_summary }
    });
    if (!created) {
      await record.update({ market_overall, guidance, risk_level, key_stocks, analysis_summary });
    }
    res.json({ code: 0, data: record });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
