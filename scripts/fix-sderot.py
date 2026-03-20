#!/usr/bin/env python3
"""Fix Sderot: the correct API name is 'שדרות, איבים', not 'שדרות'."""
import urllib.request, urllib.parse, json, os

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.alerts-cache.json')

city = '\u05e9\u05d3\u05e8\u05d5\u05ea, \u05d0\u05d9\u05d1\u05d9\u05dd'  # שדרות, איבים
params = urllib.parse.urlencode({'lang': 'he', 'mode': '3', 'city_0': city})
url = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?' + params
req = urllib.request.Request(url, headers={
    'Referer': 'https://www.oref.org.il/',
    'X-Requested-With': 'XMLHttpRequest'
})
resp = urllib.request.urlopen(req, timeout=20)
raw = resp.read()
if not raw:
    print('EMPTY response')
    exit(1)

data = json.loads(raw)
print(f'Sderot records: {len(data)}')
dates = sorted(set(a['date'] for a in data))
print(f'{len(dates)} days: {dates[0]} to {dates[-1]}')

# Merge into cache
with open(CACHE_FILE) as f:
    existing = json.load(f)
by_rid = {a['rid']: a for a in existing}
new_count = 0
for a in data:
    if a['rid'] not in by_rid:
        new_count += 1
    by_rid[a['rid']] = a
result = sorted(by_rid.values(), key=lambda x: x['rid'], reverse=True)
with open(CACHE_FILE, 'w') as f:
    json.dump(result, f, ensure_ascii=False)
print(f'Merged: {new_count} new, total: {len(result)}')
