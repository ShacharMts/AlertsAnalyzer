#!/usr/bin/env python3
"""Test city_0 API filtering for various cities."""
import urllib.request, urllib.parse, json, time

def query_city(city_name):
    params = urllib.parse.urlencode({
        'lang': 'he',
        'mode': '3',
        'city_0': city_name
    })
    url = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?' + params
    req = urllib.request.Request(url, headers={
        'Referer': 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest'
    })
    resp = urllib.request.urlopen(req, timeout=15)
    raw = resp.read()
    if not raw:
        return []
    return json.loads(raw)

# Test various cities including ones that had NO MATCH
test_cities = [
    "חיפה",        # base name (has sub-areas like "חיפה - מערב")
    "באר שבע",     # no match in 3000 records
    "שדרות",       # no match
    "אשקלון",      # has sub-areas ("אשקלון - דרום")
    "אילת",        # no match
    "קיסריה",      # no match
    "חדרה",        # no match
    "כפר סבא",     # should match
]

for city in test_cities:
    try:
        data = query_city(city)
        if data:
            cities_found = sorted(set(a['data'] for a in data))
            dates = sorted(set(a['date'] for a in data))
            print(f"{city}: {len(data)} records, {len(dates)} dates ({dates[0]}-{dates[-1]})")
            print(f"  Sub-areas: {cities_found[:5]}")
        else:
            print(f"{city}: EMPTY")
        time.sleep(0.5)
    except Exception as e:
        print(f"{city}: ERROR - {e}")
