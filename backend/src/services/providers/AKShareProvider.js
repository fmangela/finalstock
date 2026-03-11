const axios = require('axios');

/**
 * AKShare Provider - 通过东方财富接口获取A股数据
 * AKShare 是免费的Python库，这里通过HTTP接口调用
 * 也可以直接调用东方财富的公开API
 */
class AKShareProvider {
  constructor() {
    this.baseUrl = 'https://push2.eastmoney.com/api/qt';
    this.newsUrl = 'https://newsapi.eastmoney.com/kuaixun/v1';
  }

  // 获取股票实时行情
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
      return {
        code,
        name: d.f58,
        price: d.f43 / 100,
        open: d.f46 / 100,
        high: d.f44 / 100,
        low: d.f45 / 100,
        prev_close: d.f60 / 100,
        volume: d.f47,
        amount: d.f48,
        change: d.f169 / 100,
        change_pct: d.f170 / 100
      };
    } catch (e) {
      console.error('getStockQuote error:', e.message);
      return null;
    }
  }

  // 获取历史K线数据
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
        fqt: 1,
        lmt: limit,
        end: '20500101',
        ut: 'fa5fd1943c7b386f172d6893dbfba10b'
      };
      const res = await axios.get(url, { params, timeout: 8000 });
      const klines = res.data?.data?.klines || [];
      return klines.map(k => {
        const [date, open, close, high, low, volume, amount, amplitude, change_pct, change, turnover] = k.split(',');
        return { date, open: +open, close: +close, high: +high, low: +low, volume: +volume, amount: +amount, change_pct: +change_pct };
      });
    } catch (e) {
      console.error('getStockHistory error:', e.message);
      return [];
    }
  }

  // 获取大盘概览 (上证、深证、创业板)
  async getMarketOverview() {
    try {
      const indices = [
        { code: '000001', name: '上证指数', secid: '1.000001' },
        { code: '399001', name: '深证成指', secid: '0.399001' },
        { code: '399006', name: '创业板指', secid: '0.399006' }
      ];
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
          code: idx.code,
          name: d.f58 || idx.name,
          price: d.f43 / 100,
          change: d.f169 / 100,
          change_pct: d.f170 / 100,
          high: d.f44 / 100,
          low: d.f45 / 100,
          volume: d.f47
        };
      }));
      return results;
    } catch (e) {
      console.error('getMarketOverview error:', e.message);
      return [];
    }
  }

  // 获取股票列表 (A股全部)
  async getStockList(page = 1, pageSize = 50, keyword = '') {
    try {
      const url = 'https://push2.eastmoney.com/api/qt/clist/get';
      const params = {
        pn: page,
        pz: pageSize,
        po: 1,
        np: 1,
        ut: 'fa5fd1943c7b386f172d6893dbfba10b',
        fltt: 2,
        invt: 2,
        fid: 'f3',
        fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',
        fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23',
        ...(keyword ? { kw: keyword } : {})
      };
      const res = await axios.get(url, { params, timeout: 8000 });
      const diff = res.data?.data?.diff || [];
      return {
        total: res.data?.data?.total || 0,
        list: diff.map(d => ({
          code: d.f12,
          name: d.f14,
          price: d.f2,
          change_pct: d.f3,
          change: d.f4,
          volume: d.f5,
          amount: d.f6,
          amplitude: d.f7,
          turnover_rate: d.f8,
          pe: d.f9,
          pb: d.f23,
          market_cap: d.f20
        }))
      };
    } catch (e) {
      console.error('getStockList error:', e.message);
      return { total: 0, list: [] };
    }
  }

  // 获取财经新闻
  async getNews(page = 1, pageSize = 20) {
    try {
      const url = 'https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html';
      const res = await axios.get(url, { 
        timeout: 5000,
        headers: { 'Accept': 'application/json' }
      });
      // 处理返回数据，可能是 JSON 字符串或直接是对象
      let data = res.data;
      if (typeof data === 'string') {
        // 去掉 "var ajaxResult=" 前缀
        const jsonStr = data.replace(/^var ajaxResult=/, '');
        data = JSON.parse(jsonStr);
      }
      const items = data?.LivesList || [];
      return items.slice(0, pageSize).map(item => ({
        id: item.id,
        title: item.title,
        content: item.digest || item.title,
        source: '东方财富',
        pub_date: item.showtime,
        source_url: item.url_w || item.url_unique || null
      }));
    } catch (e) {
      console.error('getNews error:', e.message);
      return [];
    }
  }

  // 内部方法: 生成 secid
  _getSecid(code) {
    if (code.startsWith('6')) return `1.${code}`;
    return `0.${code}`;
  }
}

module.exports = new AKShareProvider();
