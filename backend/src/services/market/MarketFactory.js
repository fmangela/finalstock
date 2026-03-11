const AKShareProvider = require('../providers/AKShareProvider');

/**
 * MarketFactory - 数据源工厂，根据配置返回对应的数据提供者
 */
class MarketFactory {
  constructor() {
    this.providers = {
      akshare: AKShareProvider
    };
    this.current = 'akshare';
  }

  setProvider(name) {
    if (!this.providers[name]) {
      throw new Error(`Unknown provider: ${name}`);
    }
    this.current = name;
  }

  getProvider() {
    return this.providers[this.current];
  }

  async getStockList(page, pageSize, keyword) {
    return this.getProvider().getStockList(page, pageSize, keyword);
  }

  async getStockQuote(code) {
    return this.getProvider().getStockQuote(code);
  }

  async getStockHistory(code, period, limit) {
    return this.getProvider().getStockHistory(code, period, limit);
  }

  async getMarketOverview() {
    return this.getProvider().getMarketOverview();
  }

  async getNews(page, pageSize) {
    return this.getProvider().getNews(page, pageSize);
  }
}

module.exports = new MarketFactory();
