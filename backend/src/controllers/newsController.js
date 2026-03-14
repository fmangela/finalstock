// 财经新闻控制器
const DataService = require('../services/DataService');
const { StockNews } = require('../models');

// 获取新闻列表
// 优先从数据库读取（已同步的数据）；若数据库为空则实时从数据源拉取
exports.getList = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    // 先从数据库取，没有则从数据源拉取
    const dbNews = await StockNews.findAll({
      order: [['pub_date', 'DESC']],
      limit: +pageSize,
      offset: (+page - 1) * +pageSize
    });
    if (dbNews.length > 0) {
      return res.json({ code: 0, data: dbNews });
    }
    // 数据库无数据时降级到实时拉取
    const news = await DataService.getNews(+page, +pageSize);
    res.json({ code: 0, data: news });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

// 手动刷新新闻：从数据源拉取最新 50 条并去重写入数据库
exports.refresh = async (req, res) => {
  try {
    const news = await DataService.getNews(1, 50);
    for (const item of news) {
      // 以标题为唯一键，避免重复插入
      await StockNews.findOrCreate({
        where: { title: item.title },
        defaults: {
          content: item.content,
          source: item.source,
          source_url: item.source_url || null,
          pub_date: item.pub_date,
          sentiment_score: 0,
          importance: 1
        }
      });
    }
    res.json({ code: 0, message: '刷新成功', count: news.length });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};
