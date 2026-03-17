// 数据服务层：对外统一暴露数据访问接口
// 内部通过 Provider 模式切换数据源，根据系统配置动态选择
const AKShareProvider = require('./providers/AKShareProvider');
const BaoStockProvider = require('./providers/BaoStockProvider');
const TushareProvider = require('./providers/TushareProvider');

const PROVIDERS = {
  akshare:  AKShareProvider,
  baostock: BaoStockProvider,
  tushare:  TushareProvider,
};

class DataService {
  constructor() {
    this.provider = AKShareProvider;
  }

  // 从数据库读取配置，动态切换 provider
  async loadProvider() {
    try {
      const { SystemConfig } = require('../models');
      const cfg = await SystemConfig.findOne({
        where: { config_group: 'data_source', config_key: 'provider' }
      });
      const name = cfg?.config_value || 'akshare';
      this.provider = PROVIDERS[name] || AKShareProvider;
    } catch (e) {
      // 数据库未就绪时保持默认
    }
  }

  async getStockList(page, pageSize, keyword) {
    await this.loadProvider();
    return this.provider.getStockList(page, pageSize, keyword);
  }

  async getStockQuote(code) {
    await this.loadProvider();
    return this.provider.getStockQuote(code);
  }

  async getStockHistory(code, period, limit, startDate, endDate) {
    await this.loadProvider();
    return this.provider.getStockHistory(code, period, limit, startDate, endDate);
  }

  async getMarketOverview() {
    await this.loadProvider();
    return this.provider.getMarketOverview();
  }

  async getNews(page, pageSize) {
    await this.loadProvider();
    return this.provider.getNews(page, pageSize);
  }
}

module.exports = new DataService();
