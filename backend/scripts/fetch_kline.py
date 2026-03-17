#!/usr/bin/env python3
# AKShare K线数据拉取脚本，由 Node.js 子进程调用
# 用法: python3 fetch_kline.py <stock_code> <start_date> <end_date> <limit>
# stock_code: 如 000001
# start_date / end_date: YYYY-MM-DD 或 YYYYMMDD，可为空
# limit: 最多返回条数，默认 500
import sys
import json
import akshare as ak
from datetime import date, datetime

def serialize(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return str(obj)

def fetch(code, start_date, end_date, limit):
    try:
        # stock_zh_a_daily 需要 sz/sh 前缀
        if code.startswith('6'):
            symbol = 'sh' + code
        else:
            symbol = 'sz' + code

        # 日期格式统一为 YYYYMMDD
        # 没有指定 start_date 时，根据 limit 估算起始日期（交易日约为自然日 70%）
        if start_date:
            start = start_date.replace('-', '')
        else:
            from datetime import timedelta
            days_back = int(limit / 0.7) + 30
            start_dt = datetime.today() - timedelta(days=days_back)
            start = start_dt.strftime('%Y%m%d')

        end = end_date.replace('-', '') if end_date else '20991231'

        df = ak.stock_zh_a_daily(symbol=symbol, start_date=start, end_date=end, adjust='qfq')

        if df is None or df.empty:
            return []

        items = []
        for _, row in df.iterrows():
            items.append({
                'date':       str(row.get('date', ''))[:10],
                'open':       float(row.get('open', 0)),
                'close':      float(row.get('close', 0)),
                'high':       float(row.get('high', 0)),
                'low':        float(row.get('low', 0)),
                'volume':     int(row.get('volume', 0)),
                'amount':     float(row.get('amount', 0)),
                'change_pct': 0.0,
            })
        return items

    except Exception as e:
        return {'error': str(e)}

if __name__ == '__main__':
    code       = sys.argv[1] if len(sys.argv) > 1 else '000001'
    start_date = sys.argv[2] if len(sys.argv) > 2 else ''
    end_date   = sys.argv[3] if len(sys.argv) > 3 else ''
    limit      = int(sys.argv[4]) if len(sys.argv) > 4 else 500

    result = fetch(code, start_date, end_date, limit)
    print(json.dumps(result, default=serialize, ensure_ascii=False))
