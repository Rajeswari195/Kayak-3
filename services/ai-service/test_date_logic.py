from app.agents.concierge_agent import ConciergeAgent
from datetime import datetime

agent = ConciergeAgent()
now = datetime.now()
print(f"Current Date: {now}")

# Test Case 1: Past Month (Next Year)
# If current is Dec, Jan should be Next Year
date_str = "jan 10"
normalized = agent.normalize_date(date_str)
print(f"Input: '{date_str}' -> Output: '{normalized}'")

if str(now.year + 1) in normalized:
    print("PASS: Correctly identified next year.")
else:
    print("FAIL: Did not roll over to next year.")

# Test Case 2: Future Month (Current Year) - assuming we aren't in Dec for this test validity, 
# but if we are in Dec, Dec 31 should be this year (or next depending on day)
# For safety, let's test a full date
date_str_2 = "jan 10 2026"
normalized_2 = agent.normalize_date(date_str_2)
print(f"Input: '{date_str_2}' -> Output: '{normalized_2}'")
