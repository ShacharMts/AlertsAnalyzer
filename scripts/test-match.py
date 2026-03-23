#!/usr/bin/env python3
import json
cities = json.load(open('src/data/cities.json'))
matchers = sorted(cities, key=lambda c: len(c['he']), reverse=True)
separators = {' ', '-', ',', '\u05f3', "'"}

def match(loc):
    for c in matchers:
        idx = loc.find(c['he'])
        if idx == -1: continue
        if idx > 0 and loc[idx-1] not in separators: continue
        end = idx + len(c['he'])
        if end < len(loc) and loc[end] not in separators: continue
        return c['id']
    return None

tests = [
    '\u05d0\u05d1\u05df \u05d9\u05d4\u05d5\u05d3\u05d4',       # Even Yehuda
    '\u05d0\u05d7\u05d9\u05d4\u05d5\u05d3',                     # Achihud
    '\u05d1\u05e0\u05d9 \u05d9\u05d4\u05d5\u05d3\u05d4 \u05d5\u05d2\u05d1\u05e2\u05ea \u05d9\u05d5\u05d0\u05d1',  # Bnei Yehuda
    '\u05d9\u05d4\u05d5\u05d3 \u05de\u05d5\u05e0\u05d5\u05e1\u05d5\u05df',  # Yahud Monosson
    '\u05e6\u05d9\u05e4\u05d5\u05e8\u05d9',                     # Tzipori
    '\u05d0\u05d6\u05d5\u05e8 \u05ea\u05e2\u05e9\u05d9\u05d9\u05d4 \u05e6\u05d9\u05e4\u05d5\u05e8\u05d9\u05ea',  # Industrial Tzipori
    '\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1 - \u05de\u05e8\u05db\u05d6 \u05d4\u05e2\u05d9\u05e8',  # Tel Aviv center
    '\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd - \u05d3\u05e8\u05d5\u05dd',  # Jerusalem south
    '\u05d7\u05d9\u05e4\u05d4 - \u05de\u05e2\u05e8\u05d1',      # Haifa west
    '\u05d1\u05d0\u05e8 \u05e9\u05d1\u05e2 - \u05e6\u05e4\u05d5\u05df',  # Beer Sheva north
    '\u05e8\u05de\u05dc\u05d4',                                   # Ramla
    '\u05d0\u05d6\u05d5\u05e8 \u05ea\u05e2\u05e9\u05d9\u05d9\u05d4 \u05e0\u05e9\u05e8 - \u05e8\u05de\u05dc\u05d4',  # Industrial Nesher - Ramla
]
for t in tests:
    r = match(t) or '(none)'
    print(f'  {r:20s} <- {t}')
