#!/usr/bin/env python3
"""Analyze the oref alert-history page module for API parameters."""
import re

js = open('/tmp/oref-alert-page.js').read()

# Find GetAlarmsHistory
print("=== GetAlarmsHistory references ===")
for m in re.finditer(r'GetAlarmsHistory', js, re.IGNORECASE):
    start = max(0, m.start()-300)
    end = min(len(js), m.end()+300)
    print(js[start:end])
    print('---')

# Find URL construction with query params
print("\n=== Query parameter construction ===")
for m in re.finditer(r'(fromDate|toDate|mode|lang|data|area|city|location)', js):
    start = max(0, m.start()-200)
    end = min(len(js), m.end()+200)
    ctx = js[start:end]
    if 'Date' in ctx or 'mode' in ctx:
        print(ctx[:400])
        print('---')
        break  # Just need first occurrence

# Search for 'Shared/Ajax' 
print("\n=== Shared/Ajax references ===")
for m in re.finditer(r'Shared', js):
    start = max(0, m.start()-200)
    end = min(len(js), m.end()+200)
    print(js[start:end])
    print('---')

# Search for fetch/http calls
print("\n=== HTTP/fetch calls ===")
for m in re.finditer(r'(\.get\(|\.post\(|fetch\(|httpClient)', js):
    start = max(0, m.start()-300)
    end = min(len(js), m.end()+300)
    ctx = js[start:end]
    if 'alarm' in ctx.lower() or 'alert' in ctx.lower() or 'history' in ctx.lower():
        print(ctx[:600])
        print('---')
