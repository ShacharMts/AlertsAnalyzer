#!/usr/bin/env python3
"""
Parallel bulk scraper: fetch per-city alert history from oref.org.il.
Uses ThreadPoolExecutor for concurrent requests (~10x faster than sequential).
Auto-syncs both cache files on completion.
"""
import json
import os
import sys
import time
import shutil
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.alerts-cache.json')
BUNDLED_CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'data', 'alerts-cache.json')
DISTRICTS_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he'
API_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'

MAX_WORKERS = 8  # parallel threads (keep reasonable to avoid rate-limiting)
MAX_RETRIES = 2

def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers={
        'Referer': 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    resp = urllib.request.urlopen(req, timeout=timeout)
    raw = resp.read()
    if not raw or raw.strip() == b'':
        return []
    return json.loads(raw)

def find_subareas_for_cities(districts):
    cities_config = [
        ("חיפה", "starts_with"), ("נצרת", "exact_label"), ("עכו", "starts_with"),
        ("כרמיאל", "exact_label"), ("טבריה", "exact_label"), ("נהריה", "exact_label"),
        ("עפולה", "exact_label"), ("נוף הגליל", "exact_label"), ("קיסריה", "exact_label"),
        ("צפת", "starts_with"), ("קריית שמונה", "exact_label"), ("קריית אתא", "exact_label"),
        ("תל אביב", "starts_with"), ("ראשון לציון", "starts_with"),
        ("פתח תקווה", "exact_label"), ("נתניה", "starts_with"), ("חדרה", "starts_with"),
        ("תל מונד", "exact_label"), ("כפר יונה", "exact_label"), ("חולון", "exact_label"),
        ("רמת גן", "starts_with"), ("רחובות", "exact_label"), ("בני ברק", "exact_label"),
        ("הרצליה", "starts_with"), ("מודיעין מכבים רעות", "starts_with"),
        ("ראש העין", "exact_label"), ("הוד השרון", "exact_label"),
        ("רמת השרון", "exact_label"), ("רעננה", "exact_label"),
        ("אור יהודה", "exact_label"), ("יהוד מונוסון", "exact_label"),
        ("רמלה", "exact_label"), ("שוהם", "exact_label"), ("לוד", "exact_label"),
        ("ירושלים", "starts_with"), ("בית שמש", "exact_label"), ("גדרה", "exact_label"),
        ("אשדוד", "starts_with"), ("אשקלון", "starts_with"),
        ("קריית גת", "starts_with"), ("קריית מלאכי", "exact_label"),
        ("שדרות", "starts_with"), ("נתיבות", "exact_label"), ("אופקים", "exact_label"),
        ("באר שבע", "starts_with"), ("דימונה", "exact_label"), ("ערד", "exact_label"),
        ("רביבים", "exact_label"), ("מצפה רמון", "exact_label"),
        ("אילת", "exact_label"), ("כפר סבא", "exact_label"),
    ]
    result = {}
    for city_he, match_type in cities_config:
        matches = set()
        for d in districts:
            label = d.get('label', '')
            areaname = d.get('areaname', '')
            if match_type == 'exact_label':
                if label == city_he:
                    matches.add(label)
            elif match_type == 'starts_with':
                if label.startswith(city_he):
                    matches.add(label)
            if match_type == 'starts_with' and areaname == city_he:
                matches.add(label)
        if not matches:
            matches.add(city_he)
        result[city_he] = sorted(matches)
    return result

def query_subarea(sa):
    """Fetch alerts for a single sub-area with retry."""
    params = urllib.parse.urlencode({'lang': 'he', 'mode': '3', 'city_0': sa})
    url = f'{API_URL}?{params}'
    for attempt in range(MAX_RETRIES + 1):
        try:
            data = fetch_json(url)
            return sa, data, None
        except Exception as e:
            if attempt < MAX_RETRIES:
                time.sleep(1 * (attempt + 1))
            else:
                return sa, [], str(e)

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return []

def save_cache(data):
    with open(CACHE_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False)

def merge(existing, fresh):
    by_rid = {}
    for a in existing:
        by_rid[a['rid']] = a
    new_count = 0
    for a in fresh:
        if a['rid'] not in by_rid:
            new_count += 1
        by_rid[a['rid']] = a
    result = sorted(by_rid.values(), key=lambda x: x['rid'], reverse=True)
    return result, new_count

def main():
    t0 = time.time()
    print("=== Alerts Analyzer: Parallel Bulk Scraper ===\n")

    # Fetch districts
    print("Fetching districts...")
    districts = fetch_json(DISTRICTS_URL, timeout=30)
    print(f"  Got {len(districts)} districts")

    # Find sub-areas
    city_to_subareas = find_subareas_for_cities(districts)
    all_subareas = set()
    for subareas in city_to_subareas.values():
        for sa in subareas:
            all_subareas.add(sa)
    sorted_subareas = sorted(all_subareas)
    total = len(sorted_subareas)
    print(f"  Total unique sub-areas to query: {total}\n")

    # Load cache
    existing = load_cache()
    print(f"Existing cache: {len(existing)} records\n")

    # Parallel fetch
    print(f"Fetching with {MAX_WORKERS} parallel workers...")
    all_fresh = []
    errors = []
    completed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(query_subarea, sa): sa for sa in sorted_subareas}
        for future in as_completed(futures):
            sa, data, err = future.result()
            completed += 1
            count = len(data)
            if err:
                errors.append((sa, err))
                sys.stdout.write(f"\r  [{completed}/{total}] '{sa}' ERROR: {err}    \n")
            else:
                all_fresh.extend(data)
                sys.stdout.write(f"\r  [{completed}/{total}] fetched {count:>4} records  ")
            sys.stdout.flush()

    print(f"\n\nTotal fresh: {len(all_fresh)} records from {total} sub-areas")
    if errors:
        print(f"  Errors: {len(errors)}")
        for sa, err in errors:
            print(f"    - '{sa}': {err}")

    # Merge
    merged, new_count = merge(existing, all_fresh)
    print(f"After merge: {len(merged)} total ({new_count} new)")

    # Save
    save_cache(merged)
    print(f"Saved to {CACHE_FILE}")

    # Sync bundled cache
    shutil.copy2(CACHE_FILE, BUNDLED_CACHE)
    print(f"Synced to {BUNDLED_CACHE}")

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s")

if __name__ == '__main__':
    main()
