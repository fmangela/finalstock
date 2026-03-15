// 通用 AKShare 新闻 Provider
// 通过 Python 子进程调用 AKShare，绕过服务器端 IP 封锁问题
const { execFile } = require('child_process');
const path = require('path');
const logger = require('../../utils/logger');

const SCRIPT = path.join(__dirname, '../../../scripts/fetch_news.py');

function fetchByPython(source, limit) {
  return new Promise((resolve) => {
    execFile('python3', [SCRIPT, source, String(limit)], { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) {
        logger.error(`[AKShareNews] ${source} error: ${err.message}`);
        return resolve([]);
      }
      try {
        const data = JSON.parse(stdout);
        if (data?.error) {
          logger.error(`[AKShareNews] ${source} python error: ${data.error}`);
          return resolve([]);
        }
        resolve(Array.isArray(data) ? data : []);
      } catch (e) {
        logger.error(`[AKShareNews] ${source} parse error: ${e.message}`);
        resolve([]);
      }
    });
  });
}

class AKShareNewsProvider {
  constructor(source, sourceName) {
    this.source = source;
    this.sourceName = sourceName;
  }
  async getNews(page = 1, pageSize = 20) {
    return fetchByPython(this.source, pageSize);
  }
}

module.exports = {
  eastmoney: new AKShareNewsProvider('eastmoney', '东方财富'),
  cls:       new AKShareNewsProvider('cls', '财联社'),
  cx:        new AKShareNewsProvider('cx', '财新')
};
