#!/usr/bin/env python3
# AKShare 新闻拉取脚本，由 Node.js 子进程调用
# 用法: python3 fetch_news.py <source> <limit>
# source: eastmoney | cls | cx
import sys
import json
import akshare as ak
from datetime import datetime, date, time

def serialize(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, time):
        return obj.isoformat()
    return str(obj)

def fetch(source, limit):
    try:
        if source == 'eastmoney':
            # 东方财富个股新闻（通用财经新闻）
            df = ak.stock_news_em(symbol='000001')
            items = []
            for _, row in df.head(limit).iterrows():
                items.append({
                    'title':      str(row.get('新闻标题', '')),
                    'content':    str(row.get('新闻内容', ''))[:500],
                    'source':     '东方财富',
                    'pub_date':   str(row.get('发布时间', '')),
                    'source_url': str(row.get('新闻链接', '')) or None
                })
            return items

        elif source == 'cls':
            df = ak.stock_info_global_cls()
            items = []
            for _, row in df.head(limit).iterrows():
                pub_date = ''
                d = row.get('发布日期', '')
                t = row.get('发布时间', '')
                if d and t:
                    pub_date = f"{d}T{t}"
                elif d:
                    pub_date = str(d)
                items.append({
                    'title':      str(row.get('标题', '')),
                    'content':    str(row.get('内容', ''))[:500],
                    'source':     '财联社',
                    'pub_date':   pub_date,
                    'source_url': None
                })
            return items

        elif source == 'cx':
            df = ak.stock_news_main_cx()
            items = []
            for _, row in df.head(limit).iterrows():
                items.append({
                    'title':      str(row.get('summary', ''))[:100],
                    'content':    str(row.get('summary', ''))[:500],
                    'source':     '财新',
                    'pub_date':   '',
                    'source_url': str(row.get('url', '')) or None
                })
            return items

    except Exception as e:
        return {'error': str(e)}

    return []

if __name__ == '__main__':
    source = sys.argv[1] if len(sys.argv) > 1 else 'eastmoney'
    limit  = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    result = fetch(source, limit)
    print(json.dumps(result, default=serialize, ensure_ascii=False))
