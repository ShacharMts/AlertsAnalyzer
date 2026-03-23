#!/usr/bin/env python3
"""Find oref data field values that match our city names."""
import json

with open('/tmp/oref-city1566.json') as f:
    data = json.load(f)

our_cities = [
    "חיפה", "נצרת", "עכו", "כרמיאל", "טבריה", "נהריה", "עפולה", "נוף הגליל",
    "קיסריה", "צפת", "קריית שמונה", "קריית אתא", "תל אביב", "יפו",
    "ראשון לציון", "פתח תקווה", "נתניה", "חדרה", "תל מונד", "כפר יונה",
    "חולון", "רמת גן", "רחובות", "בני ברק", "הרצליה", "מודיעין", "ראש העין",
    "הוד השרון", "רמת השרון", "רעננה", "אור יהודה", "יהוד", "רמלה", "שוהם",
    "לוד", "ירושלים", "בית שמש", "גדרה", "אשדוד", "אשקלון", "קריית גת",
    "קריית מלאכי", "שדרות", "נתיבות", "אופקים", "באר שבע", "דימונה", "ערד",
    "רביבים", "מצפה רמון", "אילת", "כפר סבא"
]

all_data_values = sorted(set(a['data'] for a in data))
print(f"Total unique data values: {len(all_data_values)}")
print()

for city in our_cities:
    matches = [v for v in all_data_values if city in v]
    if matches:
        print(f"{city}: {matches}")
    else:
        print(f"{city}: NO MATCH")
