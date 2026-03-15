// 同花顺新闻 Provider
const axios = require('axios');
const logger = require('../../utils/logger');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://news.10jqka.com.cn/'
};

class ThsProvider {
  async getNews(page = 1, pageSize = 20) {
    try {
      const url = 'https://news.10jqka.com.cn/tapp/news/push/stock/';
      const res = await axios.get(url, {
        params: { page, tag: '', track: 'website', pagesize: pageSize },
        headers: HEADERS,
        timeout: 8000
      });
      const items = res.data?.data?.list || [];
      return items.slice(0, pageSize).map(item => ({
        title:      item.title,
        content:    item.digest || item.title,
        source:     '同花顺',
        pub_date:   new Date(parseInt(item.ctime) * 1000).toISOString(),
        source_url: item.url || null
      }));
    } catch (e) {
      logger.error('[ThsProvider] getNews error: ' + e.message);
      return [];
    }
  }
}

module.exports = new ThsProvider();
