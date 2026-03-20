#!/usr/bin/env python3
"""Test exact sub-area name matching for city_0."""
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
    if not raw or raw.strip() == b'':
        return []
    return json.loads(raw)

# Test with exact sub-area names AND multiple city_N params
test_cases = [
    ("Haifa exact sub-area", {"city_0": "חיפה - מערב"}),
    ("Haifa - all sub-areas", {"city_0": "חיפה - מערב", "city_1": "חיפה - כרמל, הדר ועיר תחתית", "city_2": "חיפה - מפרץ", "city_3": "חיפה - נווה שאנן ורמות כרמל", "city_4": "חיפה - בת גלים ק.אליעזר", "city_5": "חיפה - קריית חיים ושמואל"}),
    ("Beer Sheva", {"city_0": "באר שבע - דרום"}),
    ("Beer Sheva old", {"city_0": "באר שבע - צפון"}),
    ("Sderot", {"city_0": "שדרות"}),
    ("Eilat", {"city_0": "אילת"}),
    ("Caesarea", {"city_0": "קיסריה"}),
    ("Kfar Saba", {"city_0": "כפר סבא"}),
]

for label, city_params in test_cases:
    try:
        base_params = {'lang': 'he', 'mode': '3'}
        base_params.update(city_params)
        params = urllib.parse.urlencode(base_params)
        url = 'https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?' + params
        req = urllib.request.Request(url, headers={
            'Referer': 'https://www.oref.org.il/',
            'X-Requested-With': 'XMLHttpRequest'
        })
        resp = urllib.request.urlopen(req, timeout=15)
        raw = resp.read()
        if not raw or raw.strip() == b'':
            print(f"{label}: EMPTY")
        else:
            data = json.loads(raw)
            cities_found = sorted(set(a['data'] for a in data))
            dates = sorted(set(a['date'] for a in data))
            print(f"{label}: {len(data)} records, {len(dates)} dates, areas={cities_found}")
        time.sleep(0.5)
    except Exception as e:
        print(f"{label}: ERROR - {e}")
