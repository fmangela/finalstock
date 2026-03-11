const { SimulationAccount, SimulationPosition } = require('../models');
const DataService = require('../services/DataService');

exports.getAccount = async (req, res) => {
  try {
    let account = await SimulationAccount.findOne({ where: { id: 1 } });
    if (!account) {
      account = await SimulationAccount.create({ id: 1, initial_capital: 1000000, current_capital: 1000000 });
    }
    res.json({ code: 0, data: account });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.getPositions = async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const positions = await SimulationPosition.findAll({
      where,
      order: [['buy_date', 'DESC']]
    });
    res.json({ code: 0, data: positions });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.buy = async (req, res) => {
  try {
    const { stock_code, stock_name, shares, price, prediction_id } = req.body;
    const account = await SimulationAccount.findOne({ where: { id: 1 } });
    const cost = price * shares;
    if (account.current_capital < cost) {
      return res.status(400).json({ code: 400, message: '资金不足' });
    }
    const position = await SimulationPosition.create({
      prediction_id,
      stock_code,
      stock_name,
      buy_date: new Date(),
      buy_price: price,
      shares,
      current_price: price,
      status: 'holding'
    });
    await account.update({ current_capital: account.current_capital - cost });
    res.json({ code: 0, data: position });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.sell = async (req, res) => {
  try {
    const { position_id, price } = req.body;
    const position = await SimulationPosition.findByPk(position_id);
    if (!position) return res.status(404).json({ code: 404, message: '持仓不存在' });
    if (position.status === 'sold') return res.status(400).json({ code: 400, message: '已卖出' });

    const profit_loss = (price - position.buy_price) * position.shares;
    await position.update({
      status: 'sold',
      sell_date: new Date(),
      sell_price: price,
      profit_loss
    });

    const account = await SimulationAccount.findOne({ where: { id: 1 } });
    const proceeds = price * position.shares;
    const isWin = profit_loss > 0;
    await account.update({
      current_capital: +account.current_capital + proceeds,
      total_profit_loss: +account.total_profit_loss + profit_loss,
      total_trades: account.total_trades + 1,
      win_trades: account.win_trades + (isWin ? 1 : 0)
    });

    res.json({ code: 0, data: { position, profit_loss } });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
