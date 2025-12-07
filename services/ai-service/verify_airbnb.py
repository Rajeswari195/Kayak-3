from sqlmodel import Session, select
from app.database import engine
from app.models import Listing

def verify_airbnb():
    print("--- Verifying Airbnb Data Ingestion ---")
    with Session(engine) as session:
        # Check Total Count
        count = session.exec(select(Listing)).all()
        print(f"Total Listings: {len(count)}")
        
        # Check for specific Airbnb Cities
        cities = ["Manali", "Goa", "Jaipur", "New Delhi"]
        found = False
        for city in cities:
            recs = session.exec(select(Listing).where(Listing.neighbourhood.contains(city))).all()
            if recs:
                print(f"✅ Found {len(recs)} listings in {city} (Sample: {recs[0].amenities})")
                found = True
        
        if found:
            print("✅ Airbnb Data Ingestion Verified.")
        else:
            print("❌ No Airbnb cities found.")

if __name__ == "__main__":
    verify_airbnb()
