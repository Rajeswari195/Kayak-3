from app.agents.concierge_agent import ConciergeAgent

def test_norm():
    print("--- Testing Date Normalization ---")
    agent = ConciergeAgent()
    
    cases = [
        ("December 25th", "2025-12-25"),
        ("dec 25", "2025-12-25"),
        ("december 25", "2025-12-25"),
        ("Jan 1st", "2025-01-01"),
        ("2025-12-25", "2025-12-25"), # Existing valid date
        (None, None)
    ]
    
    failures = []
    
    for inp, expected in cases:
        out = agent.normalize_date(inp)
        print(f"Input: '{inp}' -> Output: '{out}'")
        if out != expected:
            failures.append(f"Failed: {inp} -> {out} (Expected {expected})")
            
    if not failures:
        print("✅ PASSED: All date formats normalized correctly.")
    else:
        print("❌ FAILED:")
        for f in failures: print(f)

if __name__ == "__main__":
    test_norm()
