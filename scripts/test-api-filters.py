#!/usr/bin/env python3
"""Try various oref API parameters to find per-city filtering."""
import json
import urllib.request
import urllib.parse

BASE = "https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx"
HEADERS = {
    "Referer": "https://www.oref.org.il/",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json",
}

def fetch(params_str):
    url = f"{BASE}?{params_str}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except Exception as e:
        return str(e)

# Test 1: mode=3 (might be by-city mode)
print("=== mode=3 ===")
d = fetch("lang=he&mode=3")
if isinstance(d, list):
    print(f"  Records: {len(d)}")
    if d:
        dates = set(a.get('date','') for a in d[:100])
        print(f"  Dates sample: {sorted(dates)}")
else:
    print(f"  Error: {d}")

# Test 2: mode=4
print("=== mode=4 ===")
d = fetch("lang=he&mode=4")
if isinstance(d, list):
    print(f"  Records: {len(d)}")
else:
    print(f"  Result type: {type(d).__name__}, {str(d)[:200]}")

# Test 3: with area/data filter
print("\n=== mode=0 with data filter (רעננה) ===")
city_encoded = urllib.parse.quote("רעננה")
d = fetch(f"lang=he&mode=0&fromDate=04.03.2026&toDate=19.03.2026&data={city_encoded}")
if isinstance(d, list):
    print(f"  Records: {len(d)}")
    raanana = [a for a in d if "רעננה" in a.get("data","")]
    print(f"  Raanana records: {len(raanana)}")
    if d:
        dates = set(a.get('date','') for a in d)
        print(f"  Dates: {sorted(dates)}")
else:
    print(f"  Error: {d}")

# Test 4: mode=0 with area parameter
print("\n=== mode=0 with area filter ===")
d = fetch(f"lang=he&mode=0&fromDate=04.03.2026&toDate=19.03.2026&area={city_encoded}")
if isinstance(d, list):
    print(f"  Records: {len(d)}")
    raanana = [a for a in d if "רעננה" in a.get("data","")]
    print(f"  Raanana records: {len(raanana)}")
    if d:
        dates = set(a.get('date','') for a in d)
        print(f"  Dates: {sorted(dates)}")
else:
    print(f"  Error: {d}")

# Test 5: mode=0 with city parameter
print("\n=== mode=0 with city filter ===")
d = fetch(f"lang=he&mode=0&fromDate=04.03.2026&toDate=19.03.2026&city={city_encoded}")
if isinstance(d, list):
    print(f"  Records: {len(d)}")
    raanana = [a for a in d if "רעננה" in a.get("data","")]
    print(f"  Raanana records: {len(raanana)}")
    if d:
        dates = set(a.get('date','') for a in d)
        print(f"  Dates: {sorted(dates)}")
else:
    print(f"  Error: {d}")

# Test 6: mode=2 (maybe filtered mode)
print("\n=== mode=2 ===")
d = fetch(f"lang=he&mode=2&fromDate=04.03.2026&toDate=19.03.2026")
if isinstance(d, list):
    print(f"  Records: {len(d)}")
    if d:
        dates = set(a.get('date','') for a in d)
        print(f"  Dates: {sorted(dates)}")
        # check structure
        print(f"  Sample keys: {list(d[0].keys()) if d else 'N/A'}")
else:
    print(f"  Result type: {type(d).__name__}, {str(d)[:200]}")

# Test 7: POST request with city filter
print("\n=== POST with data filter ===")
post_data = json.dumps({"data": "רעננה", "fromDate": "04.03.2026", "toDate": "19.03.2026"}).encode("utf-8")
try:
    req = urllib.request.Request(BASE, data=post_data, headers={**HEADERS, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        d = json.loads(resp.read().decode("utf-8"))
        if isinstance(d, list):
            print(f"  Records: {len(d)}")
            raanana = [a for a in d if "רעננה" in a.get("data","")]
            print(f"  Raanana records: {len(raanana)}")
        else:
            print(f"  Result: {str(d)[:200]}")
except Exception as e:
    print(f"  Error: {e}")
