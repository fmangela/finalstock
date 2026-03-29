// 模拟交易控制器
// 使用虚拟资金进行买卖操作，记录持仓和盈亏，不涉及真实资金
const { SimulationAccount, SimulationPosition } = require('../models');
const sequelize = require('../config/database');

function makeBizError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.code = status;
  return err;
}

// 获取模拟账户信息（资金、盈亏、胜率等）
// 若账户不存在则自动初始化（初始资金 100 万）
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

// 获取持仓列表，可按状态过滤（holding=持有中 / sold=已卖出）
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

// 模拟买入：扣减可用资金，创建持仓记录
exports.buy = async (req, res) => {
  try {
    const { stock_code, stock_name, shares, price, prediction_id } = req.body;
    const result = await sequelize.transaction(async (t) => {
      let account = await SimulationAccount.findOne({
        where: { id: 1 },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!account) {
        account = await SimulationAccount.create(
          { id: 1, initial_capital: 1000000, current_capital: 1000000 },
          { transaction: t }
        );
      }

      const buyPrice = Number(price);
      const buyShares = Number(shares);
      const cost = buyPrice * buyShares;
      const currentCapital = Number(account.current_capital);

      // 资金不足时拒绝买入
      if (currentCapital < cost) {
        throw makeBizError(400, '资金不足');
      }

      const position = await SimulationPosition.create({
        prediction_id,
        stock_code,
        stock_name,
        buy_date: new Date(),
        buy_price: buyPrice,
        shares: buyShares,
        current_price: buyPrice,
        status: 'holding'
      }, { transaction: t });

      // 扣减账户可用资金
      await account.update({ current_capital: currentCapital - cost }, { transaction: t });
      return { position };
    });

    res.json({ code: 0, data: result.position });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ code: e.code || e.status, message: e.message });
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 模拟卖出：计算盈亏，更新持仓状态和账户统计
exports.sell = async (req, res) => {
  try {
    const { position_id, price } = req.body;
    const result = await sequelize.transaction(async (t) => {
      const position = await SimulationPosition.findByPk(position_id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!position) throw makeBizError(404, '持仓不存在');
      if (position.status === 'sold') throw makeBizError(400, '已卖出');

      const sellPrice = Number(price);
      const buyPrice = Number(position.buy_price);
      const shares = Number(position.shares);

      // 计算本次交易盈亏：(卖出价 - 买入价) × 股数
      const profit_loss = (sellPrice - buyPrice) * shares;
      await position.update({
        status: 'sold',
        sell_date: new Date(),
        sell_price: sellPrice,
        profit_loss
      }, { transaction: t });

      // 更新账户：回收卖出资金，累计盈亏和交易次数
      let account = await SimulationAccount.findOne({
        where: { id: 1 },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!account) {
        account = await SimulationAccount.create(
          { id: 1, initial_capital: 1000000, current_capital: 1000000 },
          { transaction: t }
        );
      }

      const proceeds = sellPrice * shares;
      const isWin = profit_loss > 0;
      await account.update({
        current_capital:   Number(account.current_capital) + proceeds,
        total_profit_loss: Number(account.total_profit_loss) + profit_loss,
        total_trades:      Number(account.total_trades) + 1,
        win_trades:        Number(account.win_trades) + (isWin ? 1 : 0)
      }, { transaction: t });

      return { position, profit_loss };
    });
    res.json({ code: 0, data: result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ code: e.code || e.status, message: e.message });
    res.status(500).json({ code: 500, message: e.message });
  }
};
