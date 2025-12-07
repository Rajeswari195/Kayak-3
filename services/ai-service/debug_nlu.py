import re

class SimpleNLU:
    def extract(self, text: str) -> dict:
        text = text.lower()
        result = {"dates": None}
        
        # Current Logic (Reproducing failure)
        date_match = re.search(r'(on|from|starting)\s+(?P<date>.{4,15})', text)
        if date_match:
             raw_date = date_match.group("date").split(" to ")[0].split(" for ")[0]
             result["dates"] = raw_date.strip()
             
        return result

nlu = SimpleNLU()
print(f"Input: 'December 25th' -> {nlu.extract('December 25th')}")
print(f"Input: 'on December 25th' -> {nlu.extract('on December 25th')}")
