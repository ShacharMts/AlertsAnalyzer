#!/usr/bin/env python3
"""Report: missiles per city per day for the last 15 days."""
import json
from datetime import datetime, timedelta
from collections import defaultdict

data = json.load(open('.alerts-cache.json'))
cities_json = json.load(open('src/data/cities.json'))
city_he_to_en = {c['he']: c['en'] for c in cities_json}

now = datetime.now()
cutoff = now - timedelta(days=15)

# Date column headers
dates = [(now - timedelta(days=i)).strftime('%m/%d') for i in range(14, -1, -1)]

# Aggregate: city -> {date_str: missile_count}
city_days = defaultdict(lambda: defaultdict(int))

for a in data:
    if a.get('category') != 1:
        continue
    ad = a.get('alertDate', '')
    if not ad:
        continue
    try:
        ts = datetime.fromisoformat(ad)
    except Exception:
        continue
    if ts < cutoff:
        continue
    en = city_he_to_en.get(a.get('data', ''))
    if not en:
        continue
    city_days[en][ts.strftime('%m/%d')] += 1

sorted_cities = sorted(city_days.keys())

col_w = 6
name_w = 20
header = f"{'City':<{name_w}}" + ''.join(f"{d:>{col_w}}" for d in dates) + f"{'Total':>{col_w+1}}"
print(header)
print('-' * len(header))

for city in sorted_cities:
    total = 0
    row = f"{city:<{name_w}}"
    for d in dates:
        cnt = city_days[city].get(d, 0)
        total += cnt
        row += f"{cnt:>{col_w}}"
    row += f"{total:>{col_w+1}}"
    print(row)

print('-' * len(header))
row = f"{'TOTAL':<{name_w}}"
grand = 0
for d in dates:
    day_total = sum(city_days[c].get(d, 0) for c in sorted_cities)
    grand += day_total
    row += f"{day_total:>{col_w}}"
row += f"{grand:>{col_w+1}}"
print(row)
