#!/usr/bin/env python3
"""Add missing 06:49 Petah Tikva warning to cache with a unique rid."""
import json, os

cache_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.alerts-cache.json')
d = json.load(open(cache_path))
all_rids = {a['rid'] for a in d}

# Find unique rid not used by any existing record
rid = 900001
while rid in all_rids:
    rid += 1

rec = {
    "data": "\u05e4\u05ea\u05d7 \u05ea\u05e7\u05d5\u05d5\u05d4",
    "date": "19.03.2026",
    "time": "06:49:00",
    "alertDate": "2026-03-19T06:49:00",
    "category": 14,
    "category_desc": "\u05d1\u05d3\u05e7\u05d5\u05ea \u05d4\u05e7\u05e8\u05d5\u05d1\u05d5\u05ea \u05e6\u05e4\u05d5\u05d9\u05d5\u05ea \u05d4\u05ea\u05e8\u05e2\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8\u05da",
    "matrix_id": 1,
    "rid": rid
}

# Check if 06:49 warning already exists for Petah Tikva
pt_warning_0649 = [a for a in d
    if a.get('data') == "\u05e4\u05ea\u05d7 \u05ea\u05e7\u05d5\u05d5\u05d4"
    and a.get('alertDate') == "2026-03-19T06:49:00"
    and a.get('category') == 14]

if pt_warning_0649:
    print(f"Already exists: rid={pt_warning_0649[0]['rid']}")
else:
    d.append(rec)
    with open(cache_path, 'w') as f:
        json.dump(d, f)
    print(f"Added 06:49 warning with rid={rid}")

# Final count
pt = [a for a in d
    if a.get('data') == "\u05e4\u05ea\u05d7 \u05ea\u05e7\u05d5\u05d5\u05d4"
    and a.get('category') in (1, 14)]
print(f"PT missile+warning: {len(pt)}")
for a in sorted(pt, key=lambda x: x['alertDate']):
    t = "missile" if a['category'] == 1 else "warning"
    print(f"  {t:8} {a['alertDate']} rid={a['rid']}")
