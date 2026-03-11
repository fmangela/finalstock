const DataService = require('../services/DataService');
const { StockNews } = require('../models');

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
    // 从数据源拉取
    const news = await DataService.getNews(+page, +pageSize);
    res.json({ code: 0, data: news });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
};

exports.refresh = async (req, res) => {
  try {
    const news = await DataService.getNews(1, 50);
    for (const item of news) {
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
