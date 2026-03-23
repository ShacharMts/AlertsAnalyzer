#!/usr/bin/env python3
"""
Bulk scraper: fetch per-city alert history from oref.org.il and merge into .alerts-cache.json.

Uses the city_0 parameter discovered from the oref website's AlarmsHistory.js.
The API accepts exact sub-area names (from the districts JSON) as city_0 values.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.alerts-cache.json')
DISTRICTS_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he'
API_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'

# Our cities and their Hebrew names (used for substring matching)
OUR_CITIES = [
    "חיפה", "נצרת", "עכו", "כרמיאל", "טבריה", "נהריה", "עפולה", "נוף הגליל",
    "קיסריה", "צפת", "קריית שמונה", "קריית אתא", "תל אביב", "יפו",
    "ראשון לציון", "פתח תקווה", "נתניה", "חדרה", "תל מונד", "כפר יונה",
    "חולון", "רמת גן", "רחובות", "בני ברק", "הרצליה", "מודיעין", "ראש העין",
    "הוד השרון", "רמת השרון", "רעננה", "אור יהודה", "יהוד", "רמלה", "שוהם",
    "לוד", "ירושלים", "בית שמש", "גדרה", "אשדוד", "אשקלון", "קריית גת",
    "קריית מלאכי", "שדרות", "נתיבות", "אופקים", "באר שבע", "דימונה", "ערד",
    "רביבים", "מצפה רמון", "אילת", "כפר סבא"
]

def fetch_json(url):
    """Fetch JSON from a URL."""
    req = urllib.request.Request(url, headers={
        'Referer': 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest'
    })
    resp = urllib.request.urlopen(req, timeout=30)
    raw = resp.read()
    if not raw or raw.strip() == b'':
        return []
    return json.loads(raw)

def find_sub_areas(districts):
    """Find all sub-area names from districts that match our cities."""
    # Map each of our cities to the matching sub-area label names
    city_to_subareas = {}
    for city_he in OUR_CITIES:
        matches = set()
        for d in districts:
            label = d.get('label', '')
            areaname = d.get('areaname', '')
            # Match if our city name is contained in the district label OR areaname
            if city_he in label or city_he in areaname:
                matches.add(label)
        city_to_subareas[city_he] = sorted(matches)
    return city_to_subareas

def query_city(sub_area_name):
    """Query API for alerts in a specific sub-area, using mode=3 (last month)."""
    params = urllib.parse.urlencode({
        'lang': 'he',
        'mode': '3',
        'city_0': sub_area_name
    })
    url = f'{API_URL}?{params}'
    try:
        return fetch_json(url)
    except Exception as e:
        print(f"  ERROR querying '{sub_area_name}': {e}")
        return []

def load_cache():
    """Load existing cache."""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return []

def save_cache(data):
    """Save cache."""
    with open(CACHE_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False)

def merge(existing, fresh):
    """Merge fresh data into existing, dedup by rid."""
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
    print("=== Alerts Analyzer: Bulk City Scraper ===")
    print()
    
    # Step 1: Fetch districts
    print("Fetching districts from oref...")
    districts = fetch_json(DISTRICTS_URL)
    print(f"  Got {len(districts)} districts")
    
    # Step 2: Find sub-areas for our cities
    city_to_subareas = find_sub_areas(districts)
    
    # Collect all unique sub-area names to query
    all_subareas = set()
    for city_he, subareas in city_to_subareas.items():
        if subareas:
            for sa in subareas:
                all_subareas.add(sa)
        else:
            # For cities with no district match, try the city name directly
            all_subareas.add(city_he)
    
    print(f"  Found {len(all_subareas)} unique sub-areas to query")
    print()
    
    # Show mapping
    for city_he in OUR_CITIES:
        subareas = city_to_subareas.get(city_he, [])
        if subareas:
            print(f"  {city_he}: {len(subareas)} sub-areas")
        else:
            print(f"  {city_he}: direct query (no district match)")
    print()
    
    # Step 3: Load existing cache
    existing = load_cache()
    print(f"Existing cache: {len(existing)} records")
    print()
    
    # Step 4: Query each sub-area
    all_fresh = []
    total = len(all_subareas)
    sorted_subareas = sorted(all_subareas)
    
    for i, sa in enumerate(sorted_subareas, 1):
        print(f"[{i}/{total}] Querying '{sa}'...", end=' ', flush=True)
        data = query_city(sa)
        print(f"{len(data)} records")
        all_fresh.extend(data)
        
        # Rate limit: small delay between requests
        if i < total:
            time.sleep(0.3)
    
    print()
    print(f"Total fresh records: {len(all_fresh)}")
    
    # Step 5: Merge
    merged, new_count = merge(existing, all_fresh)
    print(f"After merge: {len(merged)} total records ({new_count} new)")
    
    # Step 6: Save
    save_cache(merged)
    print(f"Saved to {CACHE_FILE}")
    
    # Step 7: Report coverage
    print()
    print("=== Coverage Report ===")
    dates_by_city = {}
    for a in merged:
        data_field = a.get('data', '')
        for city_he in OUR_CITIES:
            if city_he in data_field:
                if city_he not in dates_by_city:
                    dates_by_city[city_he] = set()
                dates_by_city[city_he].add(a['date'])
                break
    
    for city_he in OUR_CITIES:
        dates = dates_by_city.get(city_he, set())
        if dates:
            sorted_dates = sorted(dates)
            print(f"  {city_he}: {len(dates)} days ({sorted_dates[0]} - {sorted_dates[-1]})")
        else:
            print(f"  {city_he}: NO DATA")

if __name__ == '__main__':
    main()
