// A 股交易日历服务
// 判断某天是否为 A 股交易日：非周末 + 非法定节假日
// 数据来源：上交所/深交所官方公告，覆盖 2024-2026 年
// 注意：周末调休上班日并不等于交易日

// ── 节假日（休市）列表 ────────────────────────────────────────
// 仅列出【工作日】中需要休市的日期（周末本身不需列出）
// 注意：不要把调休上班日放进来
const HOLIDAYS = new Set([
  // 2024 年
  '2024-01-01',                                                                   // 元旦
  '2024-02-08','2024-02-09','2024-02-12','2024-02-13','2024-02-14',
  '2024-02-15','2024-02-16',                                                      // 春节
  '2024-04-04','2024-04-05',                                                      // 清明
  '2024-05-01','2024-05-02','2024-05-03',                                         // 劳动节
  '2024-06-10',                                                                   // 端午
  '2024-09-16','2024-09-17',                                                      // 中秋
  '2024-10-01','2024-10-02','2024-10-03','2024-10-04','2024-10-07',               // 国庆

  // 2025 年
  '2025-01-01',                                                                   // 元旦
  '2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-03','2025-02-04',  // 春节（工作日休）
  '2025-04-04',                                                                   // 清明
  '2025-05-01','2025-05-02',                                                      // 劳动节
  '2025-06-02',                                                                   // 端午补休（周一）
  '2025-10-01','2025-10-02','2025-10-03','2025-10-06','2025-10-07','2025-10-08',  // 国庆+中秋

  // 2026 年（暂定，待官方公告后更新）
  '2026-01-01',                                                                   // 元旦
  '2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-23','2026-02-24',  // 春节
  '2026-04-06',                                                                   // 清明
  '2026-05-01',                                                                   // 劳动节
  '2026-06-19',                                                                   // 端午
  '2026-10-01','2026-10-02','2026-10-05','2026-10-06','2026-10-07','2026-10-08',  // 国庆
]);

// ── 调休上班日（周末但并非交易日）────────────────────────────
// 仅用于日历展示备注，不参与交易日判断
const WEEKEND_WORKDAYS = new Set([
  // 2024 年调休上班
  '2024-02-04',  // 春节调休（周日上班）
  '2024-02-18',  // 春节调休（周日上班）
  '2024-04-07',  // 清明调休（周日上班）
  '2024-04-28',  // 劳动节调休（周日上班）
  '2024-05-11',  // 劳动节调休（周六上班）
  '2024-09-14',  // 中秋调休（周六上班）
  '2024-09-29',  // 国庆调休（周日上班）
  '2024-10-12',  // 国庆调休（周六上班）

  // 2025 年调休上班
  '2025-01-26',  // 春节调休（周日上班）
  '2025-02-08',  // 春节调休（周六上班）
  '2025-04-27',  // 劳动节调休（周日上班）
  '2025-09-28',  // 国庆调休（周日上班）
  '2025-10-11',  // 国庆调休（周六上班）

  // 2026 年调休上班
  '2026-02-15',  // 春节调休（周日上班）
  '2026-02-28',  // 春节调休（周六上班）
  '2026-10-10',  // 国庆调休（周六上班）
]);

/**
 * 判断指定日期是否为 A 股交易日
 * 规则：周末休市；工作日若为法定节假日休市；其余为交易日
 */
function isTradingDay(date) {
  let dateStr;
  if (typeof date === 'string') {
    dateStr = date.slice(0, 10); // 直接用传入的字符串，避免时区转换
  } else {
    // Date 对象：用本地年月日拼接，不用 toISOString（UTC 会偏移）
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  }

  const d = new Date(dateStr + 'T12:00:00'); // 用中午12点避免时区边界问题
  const dow = d.getDay();

  // 周末不交易
  if (dow === 0 || dow === 6) return false;

  // 法定节假日不交易
  if (HOLIDAYS.has(dateStr)) return false;

  return true;
}

/**
 * 获取今天是否为交易日
 */
function isTodayTradingDay() {
  return isTradingDay(new Date());
}

/**
 * 获取下一个交易日
 */
function getNextTradingDay(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  d.setDate(d.getDate() + 1);
  for (let i = 0; i < 30; i++) {
    if (isTradingDay(d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    d.setDate(d.getDate() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 获取指定月份的交易日历（供前端日历预览）
 */
function getMonthCalendar(year, month) {
  const result = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay();
    const trading = isTradingDay(dateStr);

    let note = '';
    if (HOLIDAYS.has(dateStr)) {
      note = '节假日';
    } else if (dow === 0 || dow === 6) {
      note = WEEKEND_WORKDAYS.has(dateStr) ? '周末(调休上班)' : '周末';
    }

    result.push({ date: dateStr, trading, note, dow });
  }
  return result;
}

/**
 * 获取最近 N 个交易日（含今天，倒序）
 */
function getRecentTradingDays(n = 10) {
  const result = [];
  const d = new Date();
  while (result.length < n) {
    if (isTradingDay(d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      result.push(`${y}-${m}-${day}`);
    }
    d.setDate(d.getDate() - 1);
  }
  return result;
}

/**
 * 获取指定日期范围内的所有交易日列表
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate   - 'YYYY-MM-DD'
 * @returns {string[]}
 */
function getTradingDaysInRange(startDate, endDate) {
  const result = [];
  const d = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    if (isTradingDay(dateStr)) result.push(dateStr);
    d.setDate(d.getDate() + 1);
  }
  return result;
}

/**
 * 获取上一个交易日（不含今天）
 * @param {string} [dateStr] - 'YYYY-MM-DD'，默认今天
 * @returns {string}
 */
function getPrevTradingDay(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 30; i++) {
    if (isTradingDay(d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    d.setDate(d.getDate() - 1);
  }
  // 兜底
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 计算两个日期之间的交易日天数
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate   - 'YYYY-MM-DD'
 * @returns {number}
 */
function countTradingDays(startDate, endDate) {
  return getTradingDaysInRange(startDate, endDate).length;
}

module.exports = {
  isTradingDay,
  isTodayTradingDay,
  getNextTradingDay,
  getPrevTradingDay,
  getRecentTradingDays,
  getTradingDaysInRange,
  countTradingDays,
  getMonthCalendar,
};
