import re

class SimpleNLU:
    """
    A 'Dumb' NLU that uses Regex to extract intent and entities.
    """
    def __init__(self):
        # Cache known cities for better matching
        self.known_cities = ["Mumbai", "Delhi", "Bangalore", "Goa", "Chennai", "Paris", "Tokyo", "London", "Dubai", "New York"]

    def extract(self, text: str) -> dict:
        text = text.lower()
        result = {
            "intent": "search", # default
            "destination": None,
            "budget": None,
            "dates": None
        }
        
        # 1. Detect Intent
        if "watch" in text or "track" in text or "alert" in text:
            result["intent"] = "watch"
        elif "book" in text:
            result["intent"] = "book"
        elif "bundle" in text or "trip" in text:
            result["intent"] = "bundle"
            
        # 2. Detect Destination (Naive match against known list)
        for city in self.known_cities:
            if city.lower() in text:
                result["destination"] = city
                break # Take first match
                
        # 3. Detect Budget (Regex: $500, 500 dollars, budget 500)
        # Match $1000 or 1000
        budget_match = re.search(r'(\$|budget\s?|under\s?)(?P<amt>\d+)', text)
        if budget_match:
            try:
                result["budget"] = float(budget_match.group("amt"))
            except:
                pass
                
        # 4. Detect Dates (Very Naive: "on Dec 5", "from Jan 1")
        # We look for keywords "on", "from", "starting"
        date_match = re.search(r'(on|from|starting)\s+(?P<date>.{4,15})', text)
        if date_match:
             # Strip basic punctuation
             raw_date = date_match.group("date").split(" to ")[0].split(" for ")[0]
             result["dates"] = raw_date.strip()
             
        return result

nlu = SimpleNLU()

test_cases = [
    "Plan a trip to Mumbai",
    "Watch Delhi budget $500",
    "Book flights to Bangalore",
    "I want to go to Paris on Dec 25",
    "Track Dubai deals"
]

print("--- Testing NLU (Isolated) ---")
for t in test_cases:
    res = nlu.extract(t)
    print(f"Input: '{t}' -> {res}")
