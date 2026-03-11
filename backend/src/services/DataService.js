const AKShareProvider = require('./providers/AKShareProvider');

class DataService {
  constructor() {
    this.provider = AKShareProvider;
  }

  async getStockList(page, pageSize, keyword) {
    return this.provider.getStockList(page, pageSize, keyword);
  }

  async getStockQuote(code) {
    return this.provider.getStockQuote(code);
  }

  async getStockHistory(code, period, limit) {
    return this.provider.getStockHistory(code, period, limit);
  }

  async getMarketOverview() {
    return this.provider.getMarketOverview();
  }

  async getNews(page, pageSize) {
    return this.provider.getNews(page, pageSize);
  }
}

module.exports = new DataService();
