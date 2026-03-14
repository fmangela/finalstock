// K线缓存服务
// 查询时先查 stock_kline_cache 表，缺失再调 API 补全并写入缓存
const { KlineCache } = require('../models');
const { Op } = require('sequelize');
const SinaStockProvider = require('./providers/SinaStockProvider');
const DataService = require('./DataService');
const logger = require('../utils/logger');

/**
 * 获取指定股票在日期范围内的 K 线数据
 * 优先从缓存读取，缺失部分从 API 补全并写入缓存
 * @param {string} stockCode
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @returns {Array} 按日期升序排列的 K 线数组 [{date, open, close, high, low, volume}]
 */
async function getKlines(stockCode, startDate, endDate) {
  // 先查缓存
  const cached = await KlineCache.findAll({
    where: {
      stock_code: stockCode,
      trade_date: { [Op.between]: [startDate, endDate] }
    },
    order: [['trade_date', 'ASC']]
  });

  const cachedDates = new Set(cached.map(r => r.trade_date));

  // 判断是否需要补全：缓存为空或最新缓存日期早于 endDate
  const needFetch = cached.length === 0 ||
    cached[cached.length - 1].trade_date < endDate;

  if (needFetch) {
    const fetched = await fetchFromAPI(stockCode, startDate, endDate);
    const toInsert = fetched.filter(k => !cachedDates.has(k.date));

    if (toInsert.length > 0) {
      await bulkUpsert(stockCode, toInsert);
    }

    // 合并缓存 + 新拉取的数据
    const allMap = new Map();
    for (const r of cached) {
      allMap.set(r.trade_date, {
        date: r.trade_date, open: parseFloat(r.open), close: parseFloat(r.close),
        high: parseFloat(r.high), low: parseFloat(r.low), volume: parseInt(r.volume)
      });
    }
    for (const k of fetched) {
      if (k.date >= startDate && k.date <= endDate) {
        allMap.set(k.date, k);
      }
    }
    return Array.from(allMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  return cached.map(r => ({
    date: r.trade_date,
    open: parseFloat(r.open), close: parseFloat(r.close),
    high: parseFloat(r.high), low: parseFloat(r.low),
    volume: parseInt(r.volume)
  }));
}

/**
 * 获取单日 K 线（用于模拟交易逐日推进）
 * 先查缓存，缺失则拉取近期数据并缓存
 */
async function getDayKline(stockCode, date) {
  const cached = await KlineCache.findOne({
    where: { stock_code: stockCode, trade_date: date }
  });
  if (cached) {
    return {
      date: cached.trade_date,
      open: parseFloat(cached.open), close: parseFloat(cached.close),
      high: parseFloat(cached.high), low: parseFloat(cached.low),
      volume: parseInt(cached.volume)
    };
  }

  // 缓存未命中，拉取近 30 天数据并缓存
  const startDate = offsetDate(date, -30);
  const fetched = await fetchFromAPI(stockCode, startDate, date);
  if (fetched.length > 0) {
    await bulkUpsert(stockCode, fetched);
    const found = fetched.find(k => k.date === date);
    return found || null;
  }
  return null;
}

/**
 * 获取某日之前最近 N 条 K 线（用于指标计算）
 */
async function getRecentKlines(stockCode, beforeDate, count) {
  const cached = await KlineCache.findAll({
    where: {
      stock_code: stockCode,
      trade_date: { [Op.lte]: beforeDate }
    },
    order: [['trade_date', 'DESC']],
    limit: count
  });

  if (cached.length >= count) {
    return cached.reverse().map(r => ({
      date: r.trade_date,
      open: parseFloat(r.open), close: parseFloat(r.close),
      high: parseFloat(r.high), low: parseFloat(r.low),
      volume: parseInt(r.volume)
    }));
  }

  // 缓存不足，从 API 补全
  const startDate = offsetDate(beforeDate, -(count * 2));
  const fetched = await fetchFromAPI(stockCode, startDate, beforeDate);
  if (fetched.length > 0) {
    await bulkUpsert(stockCode, fetched);
  }

  const all = await KlineCache.findAll({
    where: {
      stock_code: stockCode,
      trade_date: { [Op.lte]: beforeDate }
    },
    order: [['trade_date', 'DESC']],
    limit: count
  });

  return all.reverse().map(r => ({
    date: r.trade_date,
    open: parseFloat(r.open), close: parseFloat(r.close),
    high: parseFloat(r.high), low: parseFloat(r.low),
    volume: parseInt(r.volume)
  }));
}

// 从 API 拉取 K 线（新浪优先，降级东方财富）
async function fetchFromAPI(stockCode, startDate, endDate) {
  try {
    const data = await SinaStockProvider.getKline(stockCode, startDate, endDate);
    if (data && data.length > 0) return data;
  } catch (e) {
    logger.warn(`[KlineService] 新浪API失败: ${e.message}`);
  }
  try {
    const data = await DataService.getStockHistory(stockCode, 'daily', 500);
    if (data && data.length > 0) return data;
  } catch (e) {
    logger.warn(`[KlineService] 东方财富API失败: ${e.message}`);
  }
  return [];
}

// 批量写入缓存（忽略重复）
async function bulkUpsert(stockCode, klines) {
  const records = klines.map(k => ({
    stock_code: stockCode,
    trade_date: k.date,
    open: k.open, close: k.close, high: k.high, low: k.low,
    volume: k.volume || 0, amount: k.amount || 0
  }));
  try {
    // 逐条 upsert，避免批量插入时唯一键冲突
    for (const r of records) {
      await KlineCache.upsert(r);
    }
  } catch (e) {
    logger.error(`[KlineService] 缓存写入失败: ${e.message}`);
  }
}

// 日期偏移工具（days 可为负）
function offsetDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { getKlines, getDayKline, getRecentKlines };
