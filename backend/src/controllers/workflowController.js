// 自动流程控制器
// 管理自动选股、自动回测、自动模拟交易的配置与执行
const { SystemConfig, StockPrediction, StockPrompt, BacktestResult, SimTask } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { getTodayStr, offsetDate, dateToStr } = require('../utils/dateUtils');

// 配置 key 前缀
const GROUP = 'workflow';

// ── 读取自动流程配置 ──────────────────────────────────────────
exports.getConfig = async (req, res) => {
  try {
    const rows = await SystemConfig.findAll({ where: { config_group: GROUP } });
    const cfg = {};
    for (const r of rows) cfg[r.config_key] = r.config_value;
    res.json({ code: 0, data: cfg });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 保存自动流程配置 ──────────────────────────────────────────
exports.saveConfig = async (req, res) => {
  try {
    const data = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(data)) {
      await SystemConfig.upsert({
        config_group: GROUP,
        config_key: key,
        config_value: String(value)
      });
    }
    res.json({ code: 0, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 手动触发自动选股 ──────────────────────────────────────────
exports.runAutoPickStock = async (req, res) => {
  try {
    const rows = await SystemConfig.findAll({ where: { config_group: GROUP } });
    const cfg = {};
    for (const r of rows) cfg[r.config_key] = r.config_value;

    const promptId = cfg.pick_prompt_id;
    const observationPeriod = cfg.pick_observation_period || '一月';

    if (!promptId) return res.json({ code: 1, message: '请先配置选股提示词' });

    // 复用 predictionController 的 execute 逻辑
    const predCtrl = require('./predictionController');
    req.body = { prompt_id: parseInt(promptId), observation_period: observationPeriod };

    // 调用 execute，捕获响应
    let executeResult = null;
    const fakeRes = {
      json: (data) => { executeResult = data; },
      status: () => fakeRes
    };
    await predCtrl.execute(req, fakeRes);

    if (!executeResult || executeResult.code !== 0) {
      return res.json({ code: 1, message: executeResult?.message || 'LLM选股失败' });
    }

    const stocks = executeResult.data?.stocks || [];
    if (stocks.length === 0) {
      return res.json({ code: 0, data: { saved: 0, message: 'LLM未返回股票' } });
    }

    // 自动确认保存所有股票
    let saved = 0;
    const now = new Date();
    for (const s of stocks) {
      if (!s.code) continue;
      const existing = await StockPrediction.findOne({ where: { stock_code: s.code } });
      if (existing) {
        await existing.update({
          stockup_date: now, stock_name: s.name,
          reason: s.reason || existing.reason,
          llm_model: executeResult.data.llm_model,
          prompt_id: parseInt(promptId),
          prompt_name: executeResult.data.prompt_name,
          llm_response: executeResult.data.raw_response,
          observation_period: observationPeriod,
          status: 'active'
        });
      } else {
        await StockPrediction.create({
          stock_code: s.code, stock_name: s.name,
          stockup_date: now, reason: s.reason || '',
          status: 'active',
          llm_model: executeResult.data.llm_model,
          prompt_id: parseInt(promptId),
          prompt_name: executeResult.data.prompt_name,
          llm_response: executeResult.data.raw_response,
          observation_period: observationPeriod
        });
      }
      saved++;
    }

    logger.info(`[Workflow] 自动选股完成，保存 ${saved} 只股票`);
    res.json({ code: 0, data: { saved, stocks } });
  } catch (e) {
    logger.error('[Workflow] 自动选股失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 手动触发自动回测 ──────────────────────────────────────────
exports.runAutoBacktest = async (req, res) => {
  try {
    const rows = await SystemConfig.findAll({ where: { config_group: GROUP } });
    const cfg = {};
    for (const r of rows) cfg[r.config_key] = r.config_value;

    // 解析配置
    const historyDays = parseInt(cfg.backtest_history_days) || 0;  // 0=仅当日
    const strategies = JSON.parse(cfg.backtest_strategies || '["ma"]');
    const strategyParamRanges = JSON.parse(cfg.backtest_strategy_params || '{}');
    const deleteLowReturn = cfg.backtest_delete_low_return === '1';
    const deleteLowWinRate = cfg.backtest_delete_low_win_rate === '1';
    const lowReturnThreshold = parseFloat(cfg.backtest_low_return_threshold || '-10');
    const lowWinRateThreshold = parseFloat(cfg.backtest_low_win_rate_threshold || '30');
    const initialCapital = parseFloat(cfg.backtest_initial_capital || '100000');

    // 确定选股日期范围
    const todayStr = getTodayStr();
    const cutoffStr = offsetDate(todayStr, -historyDays);

    // 获取目标股票（当日及历史N天内的选股）
    const predictions = await StockPrediction.findAll({
      where: {
        status: 'active',
        stockup_date: { [Op.gte]: cutoffStr }
      },
      attributes: ['stock_code', 'stock_name']
    });

    // 去重
    const stockMap = new Map();
    for (const p of predictions) {
      stockMap.set(p.stock_code, p.stock_name);
    }

    if (stockMap.size === 0) {
      return res.json({ code: 0, data: { ran: 0, skipped: 0, message: '没有符合条件的选股记录' } });
    }

    // 获取已有回测结果，用于去重判断
    const existingResults = await BacktestResult.findAll({
      attributes: ['stock_code', 'strategy_params_json'],
      where: { stock_code: { [Op.in]: Array.from(stockMap.keys()) } }
    });
    const existingSet = new Set();
    for (const r of existingResults) {
      const key = `${r.stock_code}__${JSON.stringify(r.strategy_params_json || {})}`;
      existingSet.add(key);
    }

    // 回测日期范围：过去1年到今天
    const endDate = getTodayStr();
    const startDate = offsetDate(endDate, -365);

    const backtestCtrl = require('./backtestController');
    let ran = 0, skipped = 0;

    for (const [stockCode, stockName] of stockMap) {
      for (const strategyType of strategies) {
        // 生成参数组合
        const paramCombinations = generateParamCombinations(strategyType, strategyParamRanges[strategyType] || {});

        for (const params of paramCombinations) {
          const dupKey = `${stockCode}__${JSON.stringify(params)}`;
          if (existingSet.has(dupKey)) {
            skipped++;
            continue;
          }

          // 执行回测
          const fakeReq = {
            body: {
              stock_code: stockCode, stock_name: stockName,
              start_date: startDate, end_date: endDate,
              initial_capital: initialCapital,
              strategy_type: strategyType,
              params
            }
          };
          let result = null;
          const fakeRes = {
            json: (d) => { result = d; },
            status: () => fakeRes
          };
          await backtestCtrl.runBacktest(fakeReq, fakeRes);

          if (result?.code === 0 && result.data) {
            existingSet.add(dupKey);
            ran++;
          }
        }
      }
    }

    // 删除低收益/低胜率记录
    let deleted = 0;
    if (deleteLowReturn) {
      const d = await BacktestResult.destroy({
        where: { total_return: { [Op.lt]: lowReturnThreshold } }
      });
      deleted += d;
    }
    if (deleteLowWinRate) {
      const d = await BacktestResult.destroy({
        where: { win_rate: { [Op.lt]: lowWinRateThreshold } }
      });
      deleted += d;
    }

    logger.info(`[Workflow] 自动回测完成：执行 ${ran}，跳过 ${skipped}，删除 ${deleted}`);
    res.json({ code: 0, data: { ran, skipped, deleted } });
  } catch (e) {
    logger.error('[Workflow] 自动回测失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 手动触发自动模拟交易 ─────────────────────────────────────
exports.runAutoSimulation = async (req, res) => {
  try {
    const rows = await SystemConfig.findAll({ where: { config_group: GROUP } });
    const cfg = {};
    for (const r of rows) cfg[r.config_key] = r.config_value;

    const simInitialCapital = parseFloat(cfg.sim_initial_capital || '100000');
    const minReturnThreshold = parseFloat(cfg.sim_min_return_threshold || '0');
    const minWinRateThreshold = parseFloat(cfg.sim_min_win_rate_threshold || '50');

    // 找出收益率和胜率达标的回测结果
    const goodResults = await BacktestResult.findAll({
      where: {
        total_return: { [Op.gte]: minReturnThreshold },
        win_rate: { [Op.gte]: minWinRateThreshold }
      },
      attributes: ['stock_code', 'stock_name', 'strategy_params_json', 'total_return', 'win_rate'],
      order: [['total_return', 'DESC']]
    });

    if (goodResults.length === 0) {
      return res.json({ code: 0, data: { created: 0, skipped: 0, message: '没有达标的回测记录' } });
    }

    // 获取已有模拟交易任务，避免重复创建
    const existingTasks = await SimTask.findAll({
      where: { status: { [Op.in]: ['running', 'paused'] } },
      attributes: ['stock_code', 'strategy_type', 'strategy_params']
    });
    const existingSet = new Set();
    for (const t of existingTasks) {
      const key = `${t.stock_code}__${t.strategy_type}__${JSON.stringify(t.strategy_params || {})}`;
      existingSet.add(key);
    }

    let created = 0, skipped = 0;
    for (const r of goodResults) {
      const params = r.strategy_params_json || {};
      const strategyType = params.strategy_type || 'ma';
      const strategyParams = { ...params };
      delete strategyParams.strategy_type;

      const key = `${r.stock_code}__${strategyType}__${JSON.stringify(strategyParams)}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      await SimTask.create({
        stock_code: r.stock_code,
        stock_name: r.stock_name,
        initial_capital: simInitialCapital,
        cash_balance: simInitialCapital,
        strategy_type: strategyType,
        strategy_params: strategyParams,
        trade_timing: 'pre_close',
        status: 'running',
        shares: 0, avg_cost: 0,
        total_return: 0, max_drawdown: 0,
        total_trades: 0, win_trades: 0,
        peak_value: simInitialCapital
      });
      existingSet.add(key);
      created++;
    }

    logger.info(`[Workflow] 自动模拟交易：新建 ${created}，跳过 ${skipped}`);
    res.json({ code: 0, data: { created, skipped } });
  } catch (e) {
    logger.error('[Workflow] 自动模拟交易失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 获取可用提示词列表（供配置页下拉） ───────────────────────
exports.getPrompts = async (req, res) => {
  try {
    const prompts = await StockPrompt.findAll({ attributes: ['id', 'name'] });
    res.json({ code: 0, data: prompts });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 获取可用策略列表 ─────────────────────────────────────────
exports.getStrategies = async (req, res) => {
  try {
    const Strategy = require('../strategies');
    const list = Strategy.getStrategyList();
    res.json({ code: 0, data: list });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 工具函数：根据策略类型和参数范围生成参数组合 ─────────────
function generateParamCombinations(strategyType, ranges) {
  const Strategy = require('../strategies');
  let defaultParams;
  try {
    defaultParams = Strategy.getDefaultParams(strategyType);
  } catch (e) {
    return [{}];
  }

  // 如果没有配置范围，直接用默认参数
  if (!ranges || Object.keys(ranges).length === 0) {
    return [{ ...defaultParams }];
  }

  // 对每个有范围的参数生成步进值列表
  const paramKeys = Object.keys(ranges);
  const paramValues = paramKeys.map(key => {
    const r = ranges[key];
    const min = parseFloat(r.min ?? defaultParams[key] ?? 1);
    const max = parseFloat(r.max ?? defaultParams[key] ?? min);
    const step = parseFloat(r.step ?? 1);
    const vals = [];
    for (let v = min; v <= max + 1e-9; v += step) {
      vals.push(Math.round(v * 100) / 100);
    }
    return vals.length > 0 ? vals : [defaultParams[key]];
  });

  // 笛卡尔积，最多生成 20 个组合防止爆炸
  const combos = cartesian(paramValues).slice(0, 20);
  return combos.map(combo => {
    const p = { ...defaultParams };
    paramKeys.forEach((k, i) => { p[k] = combo[i]; });
    return p;
  });
}

function cartesian(arrays) {
  return arrays.reduce((acc, arr) => {
    const result = [];
    for (const a of acc) {
      for (const b of arr) {
        result.push([...a, b]);
      }
    }
    return result;
  }, [[]]);
}

// ── 重载自动流程调度（保存配置后立即生效）────────────────────
exports.reloadSchedule = async (req, res) => {
  try {
    const scheduler = require('../services/scheduler');
    await scheduler.reloadAutoWorkflowSchedule();
    res.json({ code: 0, message: '调度已重载' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// ── 获取交易日历（供前端预览）────────────────────────────────
exports.getCalendar = async (req, res) => {
  try {
    const tradingCalendar = require('../services/tradingCalendar');
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const data  = tradingCalendar.getMonthCalendar(year, month);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
