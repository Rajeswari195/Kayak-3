from app.agents.deals_agent import deals_agent
from app.models import Flight, Listing
from app.database import engine
from sqlmodel import Session

def seed_bundle_data():
    with Session(engine) as session:
        # Seed Flight
        f = Flight(
            origin="London", destination="Mumbai", airline="UnityAir", 
            price=500.0, stops=1, duration_minutes=600, 
            departure_date="2025-12-25", seats_left=3
        )
        session.add(f)
        
        # Seed Hotel
        h = Listing(
            listing_id="h123", neighbourhood="Mumbai", price=200.0,
            date="2025-12-25", availability=5, amenity_string="Wifi, Pool, Pet friendly",
            amenities="Wifi, Pool, Pet friendly", avg_30d_price=250.0
        )
        session.add(h)
        session.commit()
        print("✅ Seeded Flight ($500) and Hotel ($200)")

def test_bundles():
    print("--- Testing Bundle Creation ---")
    seed_bundle_data()
    
    # Test Create
    bundles = deals_agent.create_bundles(destination="Mumbai", date="2025-12-25")
    
    if not bundles:
        print("❌ No bundles returned! Check DB or logic.")
        return
        
    b = bundles[0]
    print(f"✅ Generated {len(bundles)} bundles.")
    print(f"Top Bundle: ID={b['id']}")
    print(f"Components: Flight ${b['flight']['price']} + Hotel ${b['hotel']['price']}")
    print(f"Total: ${b['total_price']} (Expected $700.0)")
    
    # Fit Score Check
    score = b['fit_score']
    print(f"Fit Score: {score}/100")
    # Exp: Base 50 + Savings (~25% of Hotel?) + Amenities (Wifi, Pool -> +10)
    
    # Explanation
    print(f"Why This: {b['why_this']}")
    print(f"Watch Out: {b['what_to_watch']}")
    
    # Policy
    print(f"Policies: {b['policies']}")
    assert "Pets allowed" == b['policies'].get('pets')
    
    print("✅ Bundle Verification Passed")

    print("\n--- Testing Amenity Filtering (Refine Flow) ---")
    # Test Filter
    filtered = deals_agent.create_bundles(destination="Mumbai", date="2025-12-25", amenities=["Pool", "Pet friendly"])
    if filtered:
        print(f"✅ Filtered Search found {len(filtered)} items.")
        fb = filtered[0]
        print(f"Fit Score (Boosted): {fb['fit_score']}/100 (Expect > 90)")
        print(f"Explanation: {fb['why_this']}")
    else:
        print("❌ Filter failed to find match")

    # Test Negative Filter
    none = deals_agent.create_bundles(destination="Mumbai", amenities=["Gym", "Spa"]) # Spa not in seed
    if not none:
        print("✅ Correctly returned 0 results for missing amenities")
    else:
        print("❌ Should have returned empty for Gym/Spa")

if __name__ == "__main__":
    test_bundles()
