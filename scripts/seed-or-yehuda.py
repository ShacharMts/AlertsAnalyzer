#!/usr/bin/env python3
"""Inject missing Or Yehuda alert records into the disk cache."""
import json
import os

CACHE_PATH = os.path.join(os.path.dirname(__file__), '..', '.alerts-cache.json')
CITY_NAME = '\u05d0\u05d5\u05e8 \u05d9\u05d4\u05d5\u05d3\u05d4'  # אור יהודה
CAT_MISSILE = 1
CAT_WARNING = 14
CAT_MISSILE_DESC = '\u05d9\u05e8\u05d9 \u05e8\u05e7\u05d8\u05d5\u05ea \u05d5\u05d8\u05d9\u05dc\u05d9\u05dd'
CAT_WARNING_DESC = '\u05d4\u05ea\u05e8\u05d0\u05d4 \u05d1\u05d3\u05e7\u05d5\u05ea \u05d4\u05e7\u05e8\u05d5\u05d1\u05d5\u05ea \u05e6\u05e4\u05d5\u05d9\u05d5\u05ea \u05d4\u05ea\u05e8\u05e2\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8\u05da'

def rec(date_str, iso_date, time_str, cat, rid):
    desc = CAT_MISSILE_DESC if cat == CAT_MISSILE else CAT_WARNING_DESC
    return {
        "data": CITY_NAME,
        "date": date_str,
        "time": f"{time_str}:00",
        "alertDate": f"{iso_date}T{time_str}:00",
        "category": cat,
        "category_desc": desc,
        "matrix_id": 1,
        "rid": rid,
    }

M = CAT_MISSILE
W = CAT_WARNING

# All missing records (skipping cat13 "event ended")
# rids chosen to not conflict with existing data
missing = [
    # 19.03.2026 — today
    rec("19.03.2026", "2026-03-19", "06:49", W, 600100),
    rec("19.03.2026", "2026-03-19", "03:15", M, 600101),
    rec("19.03.2026", "2026-03-19", "03:10", W, 600102),
    # 18.03.2026 — yesterday
    rec("18.03.2026", "2026-03-18", "23:34", M, 600110),
    rec("18.03.2026", "2026-03-18", "23:30", W, 600111),
    rec("18.03.2026", "2026-03-18", "15:39", M, 600112),
    rec("18.03.2026", "2026-03-18", "15:33", W, 600113),
    rec("18.03.2026", "2026-03-18", "11:04", W, 600114),
    rec("18.03.2026", "2026-03-18", "07:51", W, 600115),
    rec("18.03.2026", "2026-03-18", "04:38", M, 600116),
    rec("18.03.2026", "2026-03-18", "04:33", W, 600117),
    rec("18.03.2026", "2026-03-18", "00:18", M, 600118),
    rec("18.03.2026", "2026-03-18", "00:11", W, 600119),
    # 17.03.2026 — Tuesday
    rec("17.03.2026", "2026-03-17", "17:44", M, 600120),
    rec("17.03.2026", "2026-03-17", "17:39", W, 600121),
    rec("17.03.2026", "2026-03-17", "15:24", W, 600122),
    rec("17.03.2026", "2026-03-17", "13:56", M, 600123),
    rec("17.03.2026", "2026-03-17", "13:51", W, 600124),
    rec("17.03.2026", "2026-03-17", "12:36", M, 600125),
    rec("17.03.2026", "2026-03-17", "12:31", W, 600126),
    rec("17.03.2026", "2026-03-17", "03:37", M, 600127),
    rec("17.03.2026", "2026-03-17", "03:30", W, 600128),
    # 16.03.2026 — Monday
    rec("16.03.2026", "2026-03-16", "22:20", M, 600130),
    rec("16.03.2026", "2026-03-16", "22:16", W, 600131),
    rec("16.03.2026", "2026-03-16", "21:08", M, 600132),
    rec("16.03.2026", "2026-03-16", "21:05", W, 600133),
    rec("16.03.2026", "2026-03-16", "20:59", W, 600134),
    rec("16.03.2026", "2026-03-16", "10:05", M, 600135),
    rec("16.03.2026", "2026-03-16", "10:01", W, 600136),
    rec("16.03.2026", "2026-03-16", "01:29", M, 600137),
    rec("16.03.2026", "2026-03-16", "01:26", W, 600138),
    # 15.03.2026 — Sunday
    rec("15.03.2026", "2026-03-15", "13:20", M, 600140),
    rec("15.03.2026", "2026-03-15", "13:15", W, 600141),
    rec("15.03.2026", "2026-03-15", "11:48", M, 600142),
    rec("15.03.2026", "2026-03-15", "11:43", W, 600143),
    rec("15.03.2026", "2026-03-15", "06:30", M, 600144),
    rec("15.03.2026", "2026-03-15", "05:33", W, 600145),
    rec("15.03.2026", "2026-03-15", "02:35", M, 600146),
    rec("15.03.2026", "2026-03-15", "02:31", M, 600147),
    rec("15.03.2026", "2026-03-15", "02:27", M, 600148),
    rec("15.03.2026", "2026-03-15", "02:24", W, 600149),
    # 14.03.2026 — Saturday
    rec("14.03.2026", "2026-03-14", "16:36", M, 600150),
    rec("14.03.2026", "2026-03-14", "16:30", M, 600151),
    rec("14.03.2026", "2026-03-14", "16:25", W, 600152),
    rec("14.03.2026", "2026-03-14", "14:43", M, 600153),
    rec("14.03.2026", "2026-03-14", "14:39", W, 600154),
    # 13.03.2026 — Friday
    rec("13.03.2026", "2026-03-13", "23:23", M, 600160),
    rec("13.03.2026", "2026-03-13", "23:16", W, 600161),
    rec("13.03.2026", "2026-03-13", "19:31", M, 600162),
    rec("13.03.2026", "2026-03-13", "19:26", W, 600163),
    rec("13.03.2026", "2026-03-13", "17:04", M, 600164),
    rec("13.03.2026", "2026-03-13", "16:58", W, 600165),
    rec("13.03.2026", "2026-03-13", "13:26", W, 600166),
    # 12.03.2026 — Thursday
    rec("12.03.2026", "2026-03-12", "21:42", M, 600170),
    rec("12.03.2026", "2026-03-12", "21:38", W, 600171),
    rec("12.03.2026", "2026-03-12", "15:03", M, 600172),
    rec("12.03.2026", "2026-03-12", "14:57", W, 600173),
]

data = json.load(open(CACHE_PATH))
all_rids = {a['rid'] for a in data}

added = 0
for r in missing:
    if r['rid'] not in all_rids:
        data.append(r)
        added += 1
        t = "missile" if r['category'] == M else "warning"
        print(f"  Added: {t:8} {r['alertDate']}")
    else:
        print(f"  Skipped (exists): rid={r['rid']}")

with open(CACHE_PATH, 'w') as f:
    json.dump(data, f)

print(f"\nAdded {added} records. Cache: {len(data)} total.")

oy = [a for a in data if a.get('data') == CITY_NAME and a['category'] in (M, W)]
missiles = [a for a in oy if a['category'] == M]
warnings = [a for a in oy if a['category'] == W]
print(f"Or Yehuda: {len(missiles)} missiles, {len(warnings)} warnings, {len(oy)} total")
for a in sorted(oy, key=lambda x: x['alertDate']):
    t = "missile" if a['category'] == M else "warning"
    print(f"  {t:8} {a['alertDate']}")
