const axios = require('axios');
const { execFile } = require('child_process');
const path = require('path');

const KLINE_SCRIPT = path.join(__dirname, '../../../scripts/fetch_kline.py');

class BaoStockProvider {
  constructor() {
    this.baseUrl = 'https://push2.eastmoney.com/api/qt';
  }

  async getStockList(page = 1, pageSize = 50, keyword = '') {
    // BaoStock is a Python library; fallback to eastmoney API
    const url = 'https://push2.eastmoney.com/api/qt/clist/get';
    const params = {
      pn: page, pz: pageSize, po: 1, np: 1,
      ut: 'fa5fd1943c7b386f172d6893dbfba10b',
      fltt: 2, invt: 2, fid: 'f3',
      fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',
      fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23',
      ...(keyword ? { kw: keyword } : {})
    };
    try {
      const res = await axios.get(url, { params, timeout: 8000 });
      const diff = res.data?.data?.diff || [];
      return {
        total: res.data?.data?.total || 0,
        list: diff.map(d => ({
          code: d.f12, name: d.f14, price: d.f2,
          change_pct: d.f3, change: d.f4, volume: d.f5,
          amount: d.f6, turnover_rate: d.f8, pe: d.f9, market_cap: d.f20
        }))
      };
    } catch (e) {
      return { total: 0, list: [] };
    }
  }

  async getStockQuote(code) {
    const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
    try {
      const res = await axios.get(`${this.baseUrl}/stock/get`, {
        params: { secid, fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170', ut: 'fa5fd1943c7b386f172d6893dbfba10b' },
        timeout: 5000
      });
      const d = res.data?.data;
      if (!d) return null;
      return { code, name: d.f58, price: d.f43 / 100, open: d.f46 / 100, high: d.f44 / 100, low: d.f45 / 100, prev_close: d.f60 / 100, volume: d.f47, change_pct: d.f170 / 100 };
    } catch (e) { return null; }
  }

  async getStockHistory(code, period = 'daily', limit = 500, startDate = '', endDate = '') {
    return new Promise((resolve) => {
      execFile('python3', [KLINE_SCRIPT, code, startDate || '', endDate || '', String(limit)], { timeout: 60000 }, (err, stdout) => {
        if (err) return resolve([]);
        try {
          const data = JSON.parse(stdout);
          resolve(Array.isArray(data) ? data : []);
        } catch { resolve([]); }
      });
    });
  }

  async getMarketOverview() {
    const indices = [
      { code: '000001', secid: '1.000001', name: '上证指数' },
      { code: '399001', secid: '0.399001', name: '深证成指' },
      { code: '399006', secid: '0.399006', name: '创业板指' }
    ];
    try {
      return await Promise.all(indices.map(async idx => {
        const res = await axios.get(`${this.baseUrl}/stock/get`, {
          params: { secid: idx.secid, fields: 'f43,f44,f45,f46,f47,f58,f60,f169,f170', ut: 'fa5fd1943c7b386f172d6893dbfba10b' },
          timeout: 5000
        });
        const d = res.data?.data;
        if (!d) return { ...idx, error: true };
        return { code: idx.code, name: d.f58 || idx.name, price: d.f43 / 100, change: d.f169 / 100, change_pct: d.f170 / 100 };
      }));
    } catch (e) { return []; }
  }

  async getNews(page = 1, pageSize = 20) {
    try {
      const res = await axios.get('https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html', { timeout: 5000 });
      return (res.data?.LivesList || []).slice(0, pageSize).map(item => ({
        id: item.id, title: item.title, content: item.digest || item.title,
        source: '东方财富', pub_date: item.showtime
      }));
    } catch (e) { return []; }
  }
}

module.exports = new BaoStockProvider();
