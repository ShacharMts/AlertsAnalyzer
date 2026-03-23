#!/usr/bin/env python3
"""Inject missing Petah Tikva alert records into the disk cache."""
import json
import os

CACHE_PATH = os.path.join(os.path.dirname(__file__), '..', '.alerts-cache.json')
CITY_NAME = '\u05e4\u05ea\u05d7 \u05ea\u05e7\u05d5\u05d5\u05d4'  # פתח תקווה
CAT_MISSILE_DESC = '\u05d9\u05e8\u05d9 \u05e8\u05e7\u05d8\u05d5\u05ea \u05d5\u05d8\u05d9\u05dc\u05d9\u05dd'
CAT_WARNING_DESC = '\u05d4\u05ea\u05e8\u05d0\u05d4 \u05d1\u05d3\u05e7\u05d5\u05ea \u05d4\u05e7\u05e8\u05d5\u05d1\u05d5\u05ea \u05e6\u05e4\u05d5\u05d9\u05d5\u05ea \u05d4\u05ea\u05e8\u05e2\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8\u05da'

d = json.load(open(CACHE_PATH))
all_rids = {a['rid'] for a in d}

# Missing records from user-provided data
missing = [
    # Today 19.03.2026 - missing from API window
    {"data": CITY_NAME, "date": "19.03.2026", "time": "06:49:00", "alertDate": "2026-03-19T06:49:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 525390},
    {"data": CITY_NAME, "date": "19.03.2026", "time": "03:15:00", "alertDate": "2026-03-19T03:15:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 524800},
    {"data": CITY_NAME, "date": "19.03.2026", "time": "03:10:00", "alertDate": "2026-03-19T03:10:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 524750},
    # Yesterday 18.03.2026
    {"data": CITY_NAME, "date": "18.03.2026", "time": "23:34:00", "alertDate": "2026-03-18T23:34:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 524200},
    {"data": CITY_NAME, "date": "18.03.2026", "time": "23:30:00", "alertDate": "2026-03-18T23:30:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 524150},
    {"data": CITY_NAME, "date": "18.03.2026", "time": "15:39:00", "alertDate": "2026-03-18T15:39:00", "category": 1, "category_desc": CAT_MISSILE_DESC, "matrix_id": 1, "rid": 523500},
    {"data": CITY_NAME, "date": "18.03.2026", "time": "15:33:00", "alertDate": "2026-03-18T15:33:00", "category": 14, "category_desc": CAT_WARNING_DESC, "matrix_id": 1, "rid": 523450},
]

added = 0
for rec in missing:
    if rec['rid'] not in all_rids:
        d.append(rec)
        added += 1
        t = "missile" if rec['category'] == 1 else "warning"
        print(f"  Added: {t:8} {rec['alertDate']}")
    else:
        print(f"  Skipped (exists): rid={rec['rid']}")

with open(CACHE_PATH, 'w') as f:
    json.dump(d, f)

print(f"\nAdded {added} records. Cache: {len(d)} total.")

# Verify
pt = [a for a in d if a.get('data') == CITY_NAME and a['category'] in (1, 14)]
print(f"Petah Tikva missile+warning records: {len(pt)}")
for a in sorted(pt, key=lambda x: x['alertDate']):
    t = "missile" if a['category'] == 1 else "warning"
    print(f"  {t:8} {a['alertDate']}")
