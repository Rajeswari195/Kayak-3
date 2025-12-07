from app.agents.concierge_agent import SimpleNLU

def test_nlu():
    nlu = SimpleNLU()
    cases = [
        ("I want to fly from London", {"origin": "London"}),
        ("Plan a trip for 2 adults", {"travelers": 2}),
        ("Trip for 5 days", {"nights": 5}),
        ("Family of 4 going to Paris", {"travelers": 4, "destination": "Paris"}),
        ("Hotel with pool and wifi", {"amenities": ["pool", "wifi"], "intent": "refine"}),
        ("Book option 1", {"intent": "book", "index": 1}),
    ]
    
    print("--- Testing Smart NLU ---")
    for text, expected in cases:
        res = nlu.extract(text)
        print(f"Input: '{text}'")
        for k, v in expected.items():
            if res.get(k) != v:
                print(f"❌ Failed {k}: Got {res.get(k)}, Expected {v}")
            else:
                 print(f"✅ {k}: {v}")
                 
if __name__ == "__main__":
    test_nlu()
