// 日期工具函数库
// 统一处理日期格式化、偏移、时区等问题，避免重复代码
const { getPrevTradingDay, getNextTradingDay, isTradingDay } = require('../services/tradingCalendar');

/**
 * 获取今日日期字符串（本地时间，格式 YYYY-MM-DD）
 * @returns {string}
 */
function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 日期偏移（自然日）
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} days - 偏移天数（可为负）
 * @returns {string} 'YYYY-MM-DD'
 */
function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00'); // 用中午12点避免时区边界问题
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 日期偏移（交易日）
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} days - 偏移天数（可为负）
 * @returns {string} 'YYYY-MM-DD'
 */
function offsetTradingDays(dateStr, days) {
  let current = dateStr;
  const direction = days > 0 ? 1 : -1;
  const count = Math.abs(days);

  for (let i = 0; i < count; i++) {
    current = direction > 0 ? getNextTradingDay(current) : getPrevTradingDay(current);
  }
  return current;
}

/**
 * 格式化日期时间（本地时间，格式 YYYY-MM-DD HH:mm）
 * @param {Date|string} date
 * @returns {string}
 */
function formatDateTime(date) {
  if (!date) return '';
  if (typeof date === 'string') return date.slice(0, 16);

  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

/**
 * Date 对象转日期字符串（本地时间，格式 YYYY-MM-DD）
 * @param {Date} date
 * @returns {string}
 */
function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  getTodayStr,
  offsetDate,
  offsetTradingDays,
  formatDateTime,
  dateToStr,
};
