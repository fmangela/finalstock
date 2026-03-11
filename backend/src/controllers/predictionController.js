const { StockPrediction } = require('../models');

exports.getList = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const where = status ? { status } : {};
    const { count, rows } = await StockPrediction.findAndCountAll({
      where,
      order: [['prediction_date', 'DESC']],
      limit: +pageSize,
      offset: (+page - 1) * +pageSize
    });
    res.json({ code: 0, data: { total: count, list: rows } });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.generate = async (req, res) => {
  try {
    const { stock_code, stock_name, target_price, stop_loss, confidence, reason, llm_model, llm_params } = req.body;
    const prediction = await StockPrediction.create({
      stock_code,
      stock_name,
      prediction_date: new Date(),
      target_price,
      stop_loss,
      confidence,
      reason,
      status: 'active',
      llm_model,
      llm_params
    });
    res.json({ code: 0, data: prediction });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.abandon = async (req, res) => {
  try {
    const { id } = req.params;
    const prediction = await StockPrediction.findByPk(id);
    if (!prediction) return res.status(404).json({ code: 404, message: '预测记录不存在' });
    await prediction.update({ status: 'abandoned' });
    res.json({ code: 0, message: '已放弃' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actual_result } = req.body;
    const prediction = await StockPrediction.findByPk(id);
    if (!prediction) return res.status(404).json({ code: 404, message: '预测记录不存在' });
    await prediction.update({ status, actual_result });
    res.json({ code: 0, data: prediction });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
