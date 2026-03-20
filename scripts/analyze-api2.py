#!/usr/bin/env python3
"""Find iframeUrl and alertHistoryPageService in the oref alert module."""
import re

js = open('/tmp/oref-alert-page.js').read()

# Find iframeUrl context
print("=== iframeUrl ===")
for m in re.finditer(r'iframeUrl', js):
    start = max(0, m.start()-200)
    end = min(len(js), m.end()+200)
    print(js[start:end])
    print('---')

# Find cityCodeAl context
print("\n=== cityCodeAl ===")
for m in re.finditer(r'cityCodeAl', js):
    start = max(0, m.start()-200)
    end = min(len(js), m.end()+200)
    print(js[start:end])
    print('---')

# Find alertHistoryPageService and GetData
print("\n=== alertHistoryPageService / GetData ===")
for m in re.finditer(r'alertHistoryPageService|GetData', js):
    start = max(0, m.start()-300)
    end = min(len(js), m.end()+300)
    print(js[start:end])
    print('---')

# Find the iframe URL construction
print("\n=== iframe URL / alerts-history.oref.org.il ===")
for m in re.finditer(r'alerts-history\.oref', js):
    start = max(0, m.start()-300)
    end = min(len(js), m.end()+300)
    print(js[start:end])
    print('---')
