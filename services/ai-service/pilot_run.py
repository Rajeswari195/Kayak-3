
import os
import sys
from sqlmodel import Session, select, func

# Add current directory to path so we can import app modules
sys.path.append(os.getcwd())

from app.services.data_ingestion import ingest_data
from app.database import engine
from app.models import Flight, Listing

def main():
    print("--- PILOT RUN STARTING ---")
    
    # 1. Force Ingestion
    print("Step 1: Running Data Ingestion...")
    try:
        ingest_data(force=True)
    except Exception as e:
        print(f"CRITICAL ERROR during ingestion: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    # 2. Verify Data
    print("\nStep 2: Verifying Data...")
    with Session(engine) as session:
        f_count = session.exec(select(func.count(Flight.id))).one()
        l_count = session.exec(select(func.count(Listing.id))).one()
        print(f"Total Flights: {f_count}")
        print(f"Total Listings: {l_count}")
        
        # 3. Check for Delhi
        print("\nStep 3: Checking for 'Delhi' flights...")
        # Check source_city or destination_city (mapped to origin/destination)
        delhi_flights = session.exec(select(Flight).where(
            (Flight.origin.contains("Delhi")) | 
            (Flight.destination.contains("Delhi"))
        ).limit(5)).all()
        
        if delhi_flights:
            print(f"✅ Found {len(delhi_flights)} sample flights matching 'Delhi':")
            for f in delhi_flights:
                print(f"   - {f.airline}: {f.origin} -> {f.destination} (${f.price})")
        else:
            print("❌ No flights found for 'Delhi'. Checking mock data?")
            
        print("\n--- PILOT RUN COMPLETE ---")

if __name__ == "__main__":
    main()
