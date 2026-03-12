const axios = require('axios');

/**
 * 新浪股票数据Provider
 */
class SinaStockProvider {
  constructor() {}

  // 获取K线数据
  async getKline(stockCode, startDate, endDate) {
    try {
      // 转换股票代码格式
      let symbol = stockCode;
      if (stockCode.startsWith('6')) {
        symbol = 'sh' + stockCode;
      } else if (stockCode.startsWith('0') || stockCode.startsWith('3')) {
        symbol = 'sz' + stockCode;
      } else {
        symbol = 'sh' + stockCode;
      }

      // 新浪API只能获取最近几年的数据
      const url = `https://quotes.sina.cn/cn/api/jsonp.php/var%20_${symbol}=/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=1024`;
      
      const res = await axios.get(url, { timeout: 15000 });
      let dataStr = res.data;
      
      // 解析返回数据 - 使用位置索引
      const startIdx = dataStr.indexOf('[');
      const endIdx = dataStr.lastIndexOf(']');
      if (startIdx < 0 || endIdx <= startIdx) {
        console.error('新浪API数据解析失败: 未找到JSON数组');
        return [];
      }

      const jsonStr = dataStr.substring(startIdx, endIdx + 1);
      const data = JSON.parse(jsonStr);

      // 转换数据格式
      const klines = data.map(item => ({
        date: item.day,
        open: parseFloat(item.open),
        close: parseFloat(item.close),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        volume: parseInt(item.volume)
      })).filter(item => item.close > 0 && item.volume > 0);

      // 直接返回所有数据（后端会处理日期过滤）
      return klines;
    } catch (e) {
      console.error('新浪股票API错误:', e.message);
      return [];
    }
  }
}

module.exports = new SinaStockProvider();