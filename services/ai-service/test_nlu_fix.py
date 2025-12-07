import re

class SimpleNLU:
    def extract(self, text: str) -> dict:
        text = text.lower()
        result = {"dates": None}
        
        # New Logic (Pasted for isolation test)
        # Strategy A: Look for "on/from/starting" + date
        date_match = re.search(r'(on|from|starting)\s+(?P<date>.{4,15})', text)
        if date_match:
             raw_date = date_match.group("date").split(" to ")[0].split(" for ")[0]
             result["dates"] = raw_date.strip()
        else:
             # Strategy B: Fallback - Look for Month names explicitly (Jan, Feb, December, etc.)
             # Matches: "dec 25", "december 25th", "jan 1"
             months = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?"
             fallback_match = re.search(months, text)
             if fallback_match:
                 result["dates"] = fallback_match.group(0)
             
        return result

nlu = SimpleNLU()
print(f"Input: 'December 25th' -> {nlu.extract('December 25th')}")
print(f"Input: 'on Dec 5' -> {nlu.extract('on Dec 5')}")
print(f"Input: 'Jan 1st' -> {nlu.extract('Jan 1st')}")
