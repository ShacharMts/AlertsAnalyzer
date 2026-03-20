#!/usr/bin/env python3
"""Find API endpoints in the oref main.js bundle."""
import re

js = open('/tmp/oref-main.js').read()

# Find all api.oref.org.il mentions with context
print("=== api.oref.org.il references ===")
for m in re.finditer(r'api\.oref\.org\.il', js):
    start = max(0, m.start()-150)
    end = min(len(js), m.end()+150)
    print(js[start:end])
    print('---')

# Find lazy-loaded alert history module chunk
print("\n=== alert-history module chunk ===")
for m in re.finditer(r'alert.history.page', js):
    start = max(0, m.start()-200)
    end = min(len(js), m.end()+200)
    print(js[start:end])
    print('---')

# Find URL construction patterns with GetAlarmsHistory
print("\n=== GetAlarmsHistory URL construction ===")
for m in re.finditer(r'GetAlarmsHistory', js, re.IGNORECASE):
    start = max(0, m.start()-300)
    end = min(len(js), m.end()+300)
    print(js[start:end])
    print('---')

# Find /api/v1/ endpoints
print("\n=== /api/v1/ endpoints ===")
for m in re.finditer(r'/api/v1/[a-zA-Z0-9/_-]+', js):
    print(m.group())
