from app.agents.concierge_agent import SimpleNLU

def test_nlu_selection():
    nlu = SimpleNLU()
    
    cases = [
        ("Chose Option 10", "book", 10),
        ("Option 2", "book", 2),
        ("I pick number 5", "book", 5),
        ("Select option 1", "book", 1),
        ("Lets go with option 3", "book", 3)
    ]
    
    print("--- Testing NLU Selection Logic ---")
    for text, expected_intent, expected_index in cases:
        res = nlu.extract(text)
        print(f"Input: '{text}' -> Intent: {res['intent']} | Index: {res.get('index')}")
        
        if res['intent'] != expected_intent:
            print(f"❌ FAIL: Expected intent {expected_intent}, got {res['intent']}")
            continue
            
        if res.get('index') != expected_index:
             print(f"❌ FAIL: Expected index {expected_index}, got {res.get('index')}")
             continue
             
        print("✅ PASS")

if __name__ == "__main__":
    test_nlu_selection()
