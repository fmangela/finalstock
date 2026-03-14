// 东方财富数据 Provider
// 通过东方财富公开 HTTP 接口获取 A 股行情、K 线、大盘指数和财经新闻
// 字段含义参考东方财富 API 文档（f43=现价×100，f58=股票名称，等）
const axios = require('axios');
const logger = require('../../utils/logger');

class AKShareProvider {
  constructor() {
    this.baseUrl = 'https://push2.eastmoney.com/api/qt';
    this.newsUrl = 'https://newsapi.eastmoney.com/kuaixun/v1';
  }

  // 获取单只股票实时行情
  // 返回：价格、涨跌幅、成交量、成交额等
  async getStockQuote(code) {
    try {
      const secid = this._getSecid(code);
      const url = `${this.baseUrl}/stock/get`;
      const params = {
        secid,
        fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f107,f169,f170,f171',
        ut: 'fa5fd1943c7b386f172d6893dbfba10b'
      };
      const res = await axios.get(url, { params, timeout: 5000 });
      const d = res.data?.data;
      if (!d) return null;
      // 东方财富接口价格字段放大了 100 倍，需除以 100 还原
      return {
        code,
        name:       d.f58,
        price:      d.f43 / 100,
        open:       d.f46 / 100,
        high:       d.f44 / 100,
        low:        d.f45 / 100,
        prev_close: d.f60 / 100,
        volume:     d.f47,
        amount:     d.f48,
        change:     d.f169 / 100,
        change_pct: d.f170 / 100
      };
    } catch (e) {
      logger.error('getStockQuote error: ' + e.message);
      return null;
    }
  }

  // 获取历史 K 线数据
  // period: daily(101) / weekly(102) / monthly(103)
  // fqt=1 表示前复权
  async getStockHistory(code, period = 'daily', limit = 100) {
    try {
      const secid = this._getSecid(code);
      const klt = { daily: 101, weekly: 102, monthly: 103 }[period] || 101;
      const url = `${this.baseUrl}/stock/kline/get`;
      const params = {
        secid,
        fields1: 'f1,f2,f3,f4,f5,f6',
        fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
        klt,
        fqt: 1,       // 前复权
        lmt: limit,
        end: '20500101',
        ut: 'fa5fd1943c7b386f172d6893dbfba10b'
      };
      const res = await axios.get(url, { params, timeout: 8000 });
      const klines = res.data?.data?.klines || [];
      // 每条 K 线是逗号分隔的字符串，按顺序解析各字段
      return klines.map(k => {
        const [date, open, close, high, low, volume, amount, amplitude, change_pct, change, turnover] = k.split(',');
        return { date, open: +open, close: +close, high: +high, low: +low, volume: +volume, amount: +amount, change_pct: +change_pct };
      });
    } catch (e) {
      logger.error('getStockHistory error: ' + e.message);
      return [];
    }
  }

  // 获取大盘三大指数概览：上证、深证、创业板
  async getMarketOverview() {
    try {
      const indices = [
        { code: '000001', name: '上证指数', secid: '1.000001' },
        { code: '399001', name: '深证成指', secid: '0.399001' },
        { code: '399006', name: '创业板指', secid: '0.399006' }
      ];
      // 并发请求三个指数，提升响应速度
      const results = await Promise.all(indices.map(async idx => {
        const url = `${this.baseUrl}/stock/get`;
        const params = {
          secid: idx.secid,
          fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170',
          ut: 'fa5fd1943c7b386f172d6893dbfba10b'
        };
        const res = await axios.get(url, { params, timeout: 5000 });
        const d = res.data?.data;
        if (!d) return { ...idx, error: true };
        return {
          code:       idx.code,
          name:       d.f58 || idx.name,
          price:      d.f43 / 100,
          change:     d.f169 / 100,
          change_pct: d.f170 / 100,
          high:       d.f44 / 100,
          low:        d.f45 / 100,
          volume:     d.f47
        };
      }));
      return results;
    } catch (e) {
      logger.error('getMarketOverview error: ' + e.message);
      return [];
    }
  }

  // 获取 A 股股票列表，支持分页和关键字搜索
  // fs 参数限定范围：沪深主板 + 创业板 + 科创板
  async getStockList(page = 1, pageSize = 50, keyword = '') {
    try {
      const url = 'https://push2.eastmoney.com/api/qt/clist/get';
      const params = {
        pn: page,
        pz: pageSize,
        po: 1,    // 降序
        np: 1,
        ut: 'fa5fd1943c7b386f172d6893dbfba10b',
        fltt: 2,
        invt: 2,
        fid: 'f3',
        fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',  // 沪深 A 股范围
        fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23',
        ...(keyword ? { kw: keyword } : {})
      };
      const res = await axios.get(url, { params, timeout: 8000 });
      const diff = res.data?.data?.diff || [];
      return {
        total: res.data?.data?.total || 0,
        list: diff.map(d => ({
          code:         d.f12,
          name:         d.f14,
          price:        d.f2,
          change_pct:   d.f3,
          change:       d.f4,
          volume:       d.f5,
          amount:       d.f6,
          amplitude:    d.f7,   // 振幅
          turnover_rate:d.f8,   // 换手率
          pe:           d.f9,   // 市盈率
          pb:           d.f23,  // 市净率
          market_cap:   d.f20   // 总市值
        }))
      };
    } catch (e) {
      logger.error('getStockList error: ' + e.message);
      return { total: 0, list: [] };
    }
  }

  // 获取财经快讯（东方财富快讯接口）
  // 返回数据可能是 JSON 对象或带 "var ajaxResult=" 前缀的 JSONP 字符串
  async getNews(page = 1, pageSize = 20) {
    try {
      const url = 'https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html';
      const res = await axios.get(url, {
        timeout: 5000,
        headers: { 'Accept': 'application/json' }
      });
      let data = res.data;
      if (typeof data === 'string') {
        // 去掉 JSONP 包装前缀，提取纯 JSON
        const jsonStr = data.replace(/^var ajaxResult=/, '');
        data = JSON.parse(jsonStr);
      }
      const items = data?.LivesList || [];
      return items.slice(0, pageSize).map(item => ({
        id:         item.id,
        title:      item.title,
        content:    item.digest || item.title,
        source:     '东方财富',
        pub_date:   item.showtime,
        source_url: item.url_w || item.url_unique || null
      }));
    } catch (e) {
      logger.error('getNews error: ' + e.message);
      return [];
    }
  }

  // 生成东方财富 secid：沪市股票前缀 1，深市前缀 0
  // 6 开头 → 沪市；0/3 开头 → 深市
  _getSecid(code) {
    if (code.startsWith('6')) return `1.${code}`;
    return `0.${code}`;
  }
}

module.exports = new AKShareProvider();
