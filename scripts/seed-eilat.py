#!/usr/bin/env python3
"""Inject missing Eilat alert records into the disk cache."""
import json
import os

CACHE_PATH = os.path.join(os.path.dirname(__file__), '..', '.alerts-cache.json')
CITY_NAME = '\u05d0\u05d9\u05dc\u05ea'  # אילת
CAT_MISSILE_DESC = '\u05d9\u05e8\u05d9 \u05e8\u05e7\u05d8\u05d5\u05ea \u05d5\u05d8\u05d9\u05dc\u05d9\u05dd'
CAT_WARNING_DESC = '\u05d4\u05ea\u05e8\u05d0\u05d4 \u05d1\u05d3\u05e7\u05d5\u05ea \u05d4\u05e7\u05e8\u05d5\u05d1\u05d5\u05ea \u05e6\u05e4\u05d5\u05d9\u05d5\u05ea \u05d4\u05ea\u05e8\u05e2\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8\u05da'

data = json.load(open(CACHE_PATH))
all_rids = {a['rid'] for a in data}

# Missing records from user-provided oref history page
missing = [
    # Yesterday 18.03.2026
    {"data": CITY_NAME, "date": "18.03.2026", "time": "16:29:00", "alertDate": "2026-03-18T16:29:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 910100},
    # Sunday 15.03.2026
    {"data": CITY_NAME, "date": "15.03.2026", "time": "11:34:00", "alertDate": "2026-03-15T11:34:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 910010},
    {"data": CITY_NAME, "date": "15.03.2026", "time": "11:40:00", "alertDate": "2026-03-15T11:40:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 910020},
    {"data": CITY_NAME, "date": "15.03.2026", "time": "01:15:00", "alertDate": "2026-03-15T01:15:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 909910},
    {"data": CITY_NAME, "date": "15.03.2026", "time": "01:20:00", "alertDate": "2026-03-15T01:20:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 909920},
    # Saturday 14.03.2026
    {"data": CITY_NAME, "date": "14.03.2026", "time": "15:06:00", "alertDate": "2026-03-14T15:06:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 909810},
    {"data": CITY_NAME, "date": "14.03.2026", "time": "15:12:00", "alertDate": "2026-03-14T15:12:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 909820},
    {"data": CITY_NAME, "date": "14.03.2026", "time": "12:40:00", "alertDate": "2026-03-14T12:40:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 909710},
    {"data": CITY_NAME, "date": "14.03.2026", "time": "12:46:00", "alertDate": "2026-03-14T12:46:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 909720},
    # Friday 13.03.2026
    {"data": CITY_NAME, "date": "13.03.2026", "time": "07:59:00", "alertDate": "2026-03-13T07:59:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 909610},
    {"data": CITY_NAME, "date": "13.03.2026", "time": "08:07:00", "alertDate": "2026-03-13T08:07:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 909620},
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
ei = [a for a in data if a.get('data') == CITY_NAME and a['category'] in (1, 14)]
print(f"Eilat missile+warning records: {len(ei)}")
for a in sorted(ei, key=lambda x: x['alertDate']):
    t = "missile" if a['category'] == 1 else "warning"
    print(f"  {t:8} {a['alertDate']}")
