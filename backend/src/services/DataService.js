// 数据服务层：对外统一暴露数据访问接口
// 内部通过 Provider 模式切换数据源，当前默认使用东方财富（AKShare）
const AKShareProvider = require('./providers/AKShareProvider');

class DataService {
  constructor() {
    // 当前使用的数据提供者，如需切换数据源只需替换此处
    this.provider = AKShareProvider;
  }

  // 获取 A 股股票列表（支持分页和关键字搜索）
  async getStockList(page, pageSize, keyword) {
    return this.provider.getStockList(page, pageSize, keyword);
  }

  // 获取单只股票实时行情
  async getStockQuote(code) {
    return this.provider.getStockQuote(code);
  }

  // 获取历史 K 线数据（period: daily/weekly/monthly）
  async getStockHistory(code, period, limit) {
    return this.provider.getStockHistory(code, period, limit);
  }

  // 获取大盘概览（上证、深证、创业板指数）
  async getMarketOverview() {
    return this.provider.getMarketOverview();
  }

  // 获取财经新闻列表
  async getNews(page, pageSize) {
    return this.provider.getNews(page, pageSize);
  }
}

module.exports = new DataService();
