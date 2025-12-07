from app.agents.concierge_agent import ConciergeAgent
from datetime import datetime, timedelta

def test_dates():
    agent = ConciergeAgent()
    now = datetime.now()
    
    cases = [
        ("In 2 weeks", (now + timedelta(weeks=2)).strftime("%Y-%m-%d")),
        ("Next weekend", (now + timedelta(weeks=1)).strftime("%Y-%m-%d")), # Approx
        ("Tomorrow", (now + timedelta(days=1)).strftime("%Y-%m-%d")),
        ("Dec 25", "2025-12-25"),
    ]
    
    print("--- Testing Relative Date Normalization ---")
    for inp, expected in cases:
        out = agent.normalize_date(inp)
        print(f"Input: '{inp}' -> Output: '{out}'")
        if out == expected:
            print("✅ Match")
        else:
            print(f"⚠️ Mismatch (Expected {expected})")

if __name__ == "__main__":
    test_dates()
