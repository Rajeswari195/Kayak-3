from app.agents.concierge_agent import SimpleNLU

nlu = SimpleNLU()

test_cases = [
    "Plan a trip to Mumbai",
    "Watch Delhi budget $500",
    "Book flights to Bangalore",
    "I want to go to Paris on Dec 25",
    "Track Dubai deals"
]

print("--- Testing NLU ---")
for t in test_cases:
    res = nlu.extract(t)
    print(f"Input: '{t}' -> {res}")
