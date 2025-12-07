from app.agents.concierge_agent import ConciergeAgent

def test_year_parsing():
    agent = ConciergeAgent()
    inputs = [
        "January 3rd 2026",
        "January 10th 2026",
        "Jan 3 2026",
        "3rd January 2026",
        "2026-01-03"
    ]
    
    print("--- Testing Year Parsing ---")
    for date_str in inputs:
        norm = agent.normalize_date(date_str)
        print(f"Input: '{date_str}' -> Normalized: '{norm}'")
        
        if "2026" in norm:
            print("✅ Year 2026 preserved.")
        else:
            print("❌ Year 2026 LOST (Probably defaulted to 2025 or failed).")

if __name__ == "__main__":
    test_year_parsing()
