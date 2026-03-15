// 财经新闻控制器
const { StockNews, SystemConfig } = require('../models');

// 获取新闻列表
exports.getList = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const dbNews = await StockNews.findAll({
      order: [['pub_date', 'DESC']],
      limit: +pageSize,
      offset: (+page - 1) * +pageSize
    });
    if (dbNews.length > 0) {
      return res.json({ code: 0, data: dbNews });
    }
    // 数据库无数据时降级到实时拉取
    const news = await fetchFromEnabledSources(+pageSize);
    res.json({ code: 0, data: news });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 手动刷新：从所有已启用来源拉取并去重写入数据库
exports.refresh = async (req, res) => {
  try {
    const news = await fetchFromEnabledSources(50);
    let created = 0;
    for (const item of news) {
      const [, isNew] = await StockNews.findOrCreate({
        where: { title: item.title },
        defaults: {
          content: item.content,
          source: item.source,
          source_url: item.source_url || null,
          pub_date: item.pub_date || new Date(),
          sentiment_score: 0,
          importance: 1
        }
      });
      if (isNew) created++;
    }
    res.json({ code: 0, message: '刷新成功', count: news.length, created });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 读取系统配置中勾选的新闻源，并发拉取后合并去重
async function fetchFromEnabledSources(pageSize = 50) {
  const config = await SystemConfig.findOne({
    where: { config_group: 'news', config_key: 'sources' }
  });
  let sources = ['eastmoney'];
  if (config?.config_value) {
    try { sources = JSON.parse(config.config_value); } catch {}
  }

  const providers = require('../services/providers/AKShareNewsProvider');
  const results = await Promise.allSettled(
    sources.map(s => providers[s]?.getNews(1, pageSize) ?? Promise.resolve([]))
  );

  const seen = new Set();
  const merged = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value) {
      if (item.title && !seen.has(item.title)) {
        seen.add(item.title);
        merged.push(item);
      }
    }
  }
  return merged;
}

