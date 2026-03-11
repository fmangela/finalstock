const axios = require('axios');

class TushareProvider {
  constructor() {
    this.apiUrl = 'http://api.tushare.pro';
    this.token = process.env.TUSHARE_TOKEN || '';
  }

  async _call(api_name, params = {}, fields = '') {
    const res = await axios.post(this.apiUrl, {
      api_name, token: this.token, params, fields
    }, { timeout: 10000 });
    return res.data?.data;
  }

  async getStockList(page = 1, pageSize = 50, keyword = '') {
    try {
      const data = await this._call('stock_basic', { list_status: 'L' }, 'ts_code,name,industry,market');
      const items = data?.items || [];
      const filtered = keyword ? items.filter(i => i[0].includes(keyword) || i[1].includes(keyword)) : items;
      const start = (page - 1) * pageSize;
      return {
        total: filtered.length,
        list: filtered.slice(start, start + pageSize).map(i => ({
          code: i[0].replace('.SH', '').replace('.SZ', ''),
          name: i[1], industry: i[2], market: i[3]
        }))
      };
    } catch (e) { return { total: 0, list: [] }; }
  }

  async getStockQuote(code) {
    // Fallback to eastmoney for real-time
    const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
    try {
      const res = await axios.get('https://push2.eastmoney.com/api/qt/stock/get', {
        params: { secid, fields: 'f43,f44,f45,f46,f47,f48,f58,f60,f169,f170', ut: 'fa5fd1943c7b386f172d6893dbfba10b' },
        timeout: 5000
      });
      const d = res.data?.data;
      if (!d) return null;
      return { code, name: d.f58, price: d.f43 / 100, open: d.f46 / 100, high: d.f44 / 100, low: d.f45 / 100, prev_close: d.f60 / 100, volume: d.f47, change_pct: d.f170 / 100 };
    } catch (e) { return null; }
  }

  async getStockHistory(code, period = 'daily', limit = 100) {
    try {
      const ts_code = code.startsWith('6') ? `${code}.SH` : `${code}.SZ`;
      const freq = { daily: 'D', weekly: 'W', monthly: 'M' }[period] || 'D';
      const data = await this._call('daily', { ts_code, limit }, 'trade_date,open,high,low,close,vol,amount,pct_chg');
      return (data?.items || []).map(i => ({
        date: i[0], open: +i[1], high: +i[2], low: +i[3], close: +i[4],
        volume: +i[5], amount: +i[6], change_pct: +i[7]
      }));
    } catch (e) { return []; }
  }

  async getMarketOverview() {
    const indices = [
      { code: '000001', secid: '1.000001', name: '上证指数' },
      { code: '399001', secid: '0.399001', name: '深证成指' },
      { code: '399006', secid: '0.399006', name: '创业板指' }
    ];
    try {
      return await Promise.all(indices.map(async idx => {
        const res = await axios.get('https://push2.eastmoney.com/api/qt/stock/get', {
          params: { secid: idx.secid, fields: 'f43,f44,f45,f58,f60,f169,f170', ut: 'fa5fd1943c7b386f172d6893dbfba10b' },
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

module.exports = new TushareProvider();
