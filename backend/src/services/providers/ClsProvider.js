// 财联社新闻 Provider
const axios = require('axios');
const logger = require('../../utils/logger');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.cls.cn/'
};

class ClsProvider {
  async getNews(page = 1, pageSize = 20) {
    try {
      const url = 'https://www.cls.cn/nodeapi/updateTelegraphList';
      const res = await axios.get(url, {
        params: { app: 'CailianpressWeb', os: 'web', sv: '8.4.6', rn: pageSize, last_time: 0 },
        headers: HEADERS,
        timeout: 8000
      });
      const items = res.data?.data?.roll_data || [];
      return items.slice(0, pageSize).map(item => ({
        title:      item.title || item.brief?.slice(0, 100) || '财联社快讯',
        content:    item.content || item.brief || '',
        source:     '财联社',
        pub_date:   new Date(item.ctime * 1000).toISOString(),
        source_url: item.shareurl || null
      }));
    } catch (e) {
      logger.error('[ClsProvider] getNews error: ' + e.message);
      return [];
    }
  }
}

module.exports = new ClsProvider();

