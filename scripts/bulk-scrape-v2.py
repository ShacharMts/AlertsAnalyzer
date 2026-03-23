#!/usr/bin/env python3
"""
Bulk scraper v2: fetch per-city alert history from oref.org.il.
Uses exact sub-area matching via the districts JSON, with precise city-name boundaries.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.alerts-cache.json')
DISTRICTS_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he'
API_URL = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx'

# Map our city IDs to their exact sub-area names used by the oref API.
# For most cities, we use exact label match or areaname match from districts.
# For cities with sub-areas (like "חיפה - מערב"), we list all sub-areas.
# This mapping is built from districts.json analysis + manual verification.

def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers={
        'Referer': 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest'
    })
    resp = urllib.request.urlopen(req, timeout=timeout)
    raw = resp.read()
    if not raw or raw.strip() == b'':
        return []
    return json.loads(raw)

def find_subareas_for_cities(districts):
    """Find sub-area names from districts that match our cities using precise matching."""
    # Our cities: (hebrew_name, match_type)
    # match_type: 'exact_label' = label must equal city name exactly
    #             'starts_with' = label must start with city name (for "cityname - subarea" patterns)
    #             'areaname' = areaname equals city name (to find all sub-areas in that area)
    cities_config = [
        ("חיפה", "starts_with"),
        ("נצרת", "exact_label"),
        ("עכו", "starts_with"),
        ("כרמיאל", "exact_label"),
        ("טבריה", "exact_label"),
        ("נהריה", "exact_label"),
        ("עפולה", "exact_label"),
        ("נוף הגליל", "exact_label"),
        ("קיסריה", "exact_label"),
        ("צפת", "starts_with"),
        ("קריית שמונה", "exact_label"),
        ("קריית אתא", "exact_label"),
        ("תל אביב", "starts_with"),
        ("ראשון לציון", "starts_with"),
        ("פתח תקווה", "exact_label"),
        ("נתניה", "starts_with"),
        ("חדרה", "starts_with"),
        ("תל מונד", "exact_label"),
        ("כפר יונה", "exact_label"),
        ("חולון", "exact_label"),
        ("רמת גן", "starts_with"),
        ("רחובות", "exact_label"),
        ("בני ברק", "exact_label"),
        ("הרצליה", "starts_with"),
        ("מודיעין מכבים רעות", "starts_with"),  # may have sub-areas
        ("ראש העין", "exact_label"),
        ("הוד השרון", "exact_label"),
        ("רמת השרון", "exact_label"),
        ("רעננה", "exact_label"),
        ("אור יהודה", "exact_label"),
        ("יהוד מונוסון", "exact_label"),  # exact name for Yahud
        ("רמלה", "exact_label"),
        ("שוהם", "exact_label"),
        ("לוד", "exact_label"),
        ("ירושלים", "starts_with"),
        ("בית שמש", "exact_label"),
        ("גדרה", "exact_label"),
        ("אשדוד", "starts_with"),
        ("אשקלון", "starts_with"),
        ("קריית גת", "starts_with"),
        ("קריית מלאכי", "exact_label"),
        ("שדרות", "starts_with"),
        ("נתיבות", "exact_label"),
        ("אופקים", "exact_label"),
        ("באר שבע", "starts_with"),
        ("דימונה", "exact_label"),
        ("ערד", "exact_label"),
        ("רביבים", "exact_label"),
        ("מצפה רמון", "exact_label"),
        ("אילת", "exact_label"),
        ("כפר סבא", "exact_label"),
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
            elif match_type == 'starts_with_special':
                # For יפו: match "תל אביב - דרום העיר ויפו"
                if city_he in label:
                    matches.add(label)
            
            # Also check areaname for cities that are areas
            if match_type in ('starts_with',) and areaname == city_he:
                matches.add(label)
        
        if not matches:
            # Try direct query with city name
            matches.add(city_he)
        
        result[city_he] = sorted(matches)
    
    return result

def query_city(sub_area_name):
    params = urllib.parse.urlencode({
        'lang': 'he',
        'mode': '3',
        'city_0': sub_area_name
    })
    url = f'{API_URL}?{params}'
    try:
        return fetch_json(url)
    except Exception as e:
        print(f"  ERROR: {e}")
        return []

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
    print("=== Alerts Analyzer: Bulk City Scraper v2 ===\n")
    
    # Fetch districts
    print("Fetching districts...")
    districts = fetch_json(DISTRICTS_URL, timeout=30)
    print(f"  Got {len(districts)} districts")
    
    # Find sub-areas
    city_to_subareas = find_subareas_for_cities(districts)
    
    # Collect unique sub-areas to query
    all_subareas = set()
    for city_he, subareas in city_to_subareas.items():
        for sa in subareas:
            all_subareas.add(sa)
    
    print(f"  Total unique sub-areas: {len(all_subareas)}\n")
    
    for city_he, subareas in sorted(city_to_subareas.items()):
        print(f"  {city_he}: {len(subareas)} ({', '.join(subareas[:3])}{'...' if len(subareas) > 3 else ''})")
    print()
    
    # Load cache
    existing = load_cache()
    print(f"Existing cache: {len(existing)} records\n")
    
    # Query each sub-area
    all_fresh = []
    sorted_subareas = sorted(all_subareas)
    total = len(sorted_subareas)
    
    for i, sa in enumerate(sorted_subareas, 1):
        sys.stdout.write(f"[{i}/{total}] '{sa}'... ")
        sys.stdout.flush()
        data = query_city(sa)
        print(f"{len(data)} records")
        all_fresh.extend(data)
        if i < total:
            time.sleep(0.3)
    
    print(f"\nTotal fresh: {len(all_fresh)}")
    
    # Merge
    merged, new_count = merge(existing, all_fresh)
    print(f"After merge: {len(merged)} total ({new_count} new)")
    
    # Save
    save_cache(merged)
    print(f"Saved to {CACHE_FILE}")
    
    # Also sync to bundled cache for Netlify/Vercel deployments
    bundled = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'data', 'alerts-cache.json')
    import shutil
    shutil.copy2(CACHE_FILE, bundled)
    print(f"Synced to {bundled}\n")
    
    # Coverage report
    print("=== Coverage Report ===")
    our_cities_he = [
        "חיפה", "נצרת", "עכו", "כרמיאל", "טבריה", "נהריה", "עפולה", "נוף הגליל",
        "קיסריה", "צפת", "קריית שמונה", "קריית אתא", "תל אביב",
        "ראשון לציון", "פתח תקווה", "נתניה", "חדרה", "תל מונד", "כפר יונה",
        "חולון", "רמת גן", "רחובות", "בני ברק", "הרצליה", "מודיעין מכבים רעות", "ראש העין",
        "הוד השרון", "רמת השרון", "רעננה", "אור יהודה", "יהוד", "רמלה", "שוהם",
        "לוד", "ירושלים", "בית שמש", "גדרה", "אשדוד", "אשקלון", "קריית גת",
        "קריית מלאכי", "שדרות", "נתיבות", "אופקים", "באר שבע", "דימונה", "ערד",
        "רביבים", "מצפה רמון", "אילת", "כפר סבא"
    ]
    
    for city_he in our_cities_he:
        city_records = [a for a in merged if city_he in a.get('data', '')]
        if city_records:
            dates = sorted(set(a['date'] for a in city_records))
            total_recs = len(city_records)
            print(f"  {city_he}: {total_recs} records, {len(dates)} days ({dates[0]} - {dates[-1]})")
        else:
            print(f"  {city_he}: NO DATA")

if __name__ == '__main__':
    main()
