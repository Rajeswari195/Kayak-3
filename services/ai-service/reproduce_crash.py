from app.agents.concierge_agent import SimpleNLU

def reproduce():
    nlu = SimpleNLU()
    
    # The string user typed (or possibly pasted)
    # The error said: Incorrect date value: '1 vistara - $24'
    text = "Book Option 1 Vistara - $2476.0"
    
    print(f"Input: '{text}'")
    res = nlu.extract(text)
    
    print(f"Extracted Intent: {res['intent']}")
    print(f"Extracted Dates:  '{res['dates']}'")
    
    # Check if 'dates' matches the garbage string
    if res['dates'] and "vistara" in res['dates'].lower():
        print("🚨 REPRODUCED: NLU extracted garbage as date!")
    else:
        print("✅ Clean: NLU did not extract garbage.")

if __name__ == "__main__":
    reproduce()
