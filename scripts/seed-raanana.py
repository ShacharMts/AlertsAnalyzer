#!/usr/bin/env python3
"""Inject missing Ra'anana alert records into the disk cache."""
import json
import os

CACHE_PATH = os.path.join(os.path.dirname(__file__), '..', '.alerts-cache.json')
CITY_NAME = '\u05e8\u05e2\u05e0\u05e0\u05d4'  # רעננה
CAT_MISSILE_DESC = '\u05d9\u05e8\u05d9 \u05e8\u05e7\u05d8\u05d5\u05ea \u05d5\u05d8\u05d9\u05dc\u05d9\u05dd'
CAT_WARNING_DESC = '\u05d4\u05ea\u05e8\u05d0\u05d4 \u05d1\u05d3\u05e7\u05d5\u05ea \u05d4\u05e7\u05e8\u05d5\u05d1\u05d5\u05ea \u05e6\u05e4\u05d5\u05d9\u05d5\u05ea \u05d4\u05ea\u05e8\u05e2\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8\u05da'

data = json.load(open(CACHE_PATH))
all_rids = {a['rid'] for a in data}

# Missing records from user-provided oref history page
missing = [
    # Today 19.03.2026
    {"data": CITY_NAME, "date": "19.03.2026", "time": "03:10:00", "alertDate": "2026-03-19T03:10:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 524740},
    {"data": CITY_NAME, "date": "19.03.2026", "time": "03:16:00", "alertDate": "2026-03-19T03:16:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 524810},
    # Yesterday 18.03.2026
    {"data": CITY_NAME, "date": "18.03.2026", "time": "15:33:00", "alertDate": "2026-03-18T15:33:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 523440},
    {"data": CITY_NAME, "date": "18.03.2026", "time": "15:39:00", "alertDate": "2026-03-18T15:39:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 523510},
    {"data": CITY_NAME, "date": "18.03.2026", "time": "23:29:00", "alertDate": "2026-03-18T23:29:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 524140},
    {"data": CITY_NAME, "date": "18.03.2026", "time": "23:34:00", "alertDate": "2026-03-18T23:34:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 524210},
]

added = 0
for rec in missing:
    if rec['rid'] not in all_rids:
        data.append(rec)
        added += 1
        t = "missile" if rec['category'] == 1 else "warning"
        print(f"  Added: {t:8} {rec['alertDate']}")
    else:
        print(f"  Skipped (exists): rid={rec['rid']}")

with open(CACHE_PATH, 'w') as f:
    json.dump(data, f)

print(f"\nAdded {added} records. Cache: {len(data)} total.")

# Verify
ra = [a for a in data if a.get('data') == CITY_NAME and a['category'] in (1, 14)]
print(f"Ra'anana missile+warning records: {len(ra)}")
for a in sorted(ra, key=lambda x: x['alertDate']):
    t = "missile" if a['category'] == 1 else "warning"
    print(f"  {t:8} {a['alertDate']}")
