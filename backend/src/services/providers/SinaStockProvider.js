// 新浪财经 K 线数据 Provider
// 作为东方财富的备用数据源，主要用于回测时获取较长历史数据
// 接口返回 JSONP 格式，需手动解析 JSON 数组
const axios = require('axios');
const logger = require('../../utils/logger');

class SinaStockProvider {
  constructor() {}

  // 获取指定股票的日 K 线数据
  // startDate / endDate 由调用方（backtestController）在返回后过滤
  async getKline(stockCode, startDate, endDate) {
    try {
      // 将纯数字代码转换为新浪格式：sh600000 / sz000001
      let symbol = stockCode;
      if (stockCode.startsWith('6')) {
        symbol = 'sh' + stockCode;       // 沪市
      } else if (stockCode.startsWith('0') || stockCode.startsWith('3')) {
        symbol = 'sz' + stockCode;       // 深市 / 创业板
      } else {
        symbol = 'sh' + stockCode;       // 默认沪市
      }

      // scale=240 表示日线；datalen=1024 获取尽量多的历史数据
      const url = `https://quotes.sina.cn/cn/api/jsonp.php/var%20_${symbol}=/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=1024`;

      const res = await axios.get(url, { timeout: 15000 });
      let dataStr = res.data;

      // 新浪返回 JSONP 格式：var _sh600000=[{...}]
      // 通过查找第一个 '[' 和最后一个 ']' 提取 JSON 数组
      const startIdx = dataStr.indexOf('[');
      const endIdx = dataStr.lastIndexOf(']');
      if (startIdx < 0 || endIdx <= startIdx) {
        logger.error('新浪API数据解析失败: 未找到JSON数组');
        return [];
      }

      const jsonStr = dataStr.substring(startIdx, endIdx + 1);
      const data = JSON.parse(jsonStr);

      // 统一转换为标准 K 线格式，过滤掉无效数据（收盘价或成交量为 0）
      const klines = data.map(item => ({
        date:   item.day,
        open:   parseFloat(item.open),
        close:  parseFloat(item.close),
        high:   parseFloat(item.high),
        low:    parseFloat(item.low),
        volume: parseInt(item.volume)
      })).filter(item => item.close > 0 && item.volume > 0);

      // 日期过滤由 backtestController 处理，此处返回全量数据
      return klines;
    } catch (e) {
      logger.error('新浪股票API错误: ' + e.message);
      return [];
    }
  }
}

module.exports = new SinaStockProvider();
