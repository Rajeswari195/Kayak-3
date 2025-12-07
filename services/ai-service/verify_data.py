
from sqlmodel import Session, select, func
from app.database import engine
from app.models import Listing, Flight, Deal

def verify():
    with Session(engine) as session:
        # Count rows
        listing_count = session.exec(select(func.count(Listing.id))).one()
        flight_count = session.exec(select(func.count(Flight.id))).one()
        
        print(f"--- Data Verification ---")
        print(f"Listings (Hotels): {listing_count}")
        print(f"Flights:           {flight_count}")
        
        # Show samples
        print(f"\n--- Sample Listing ---")
        listing = session.exec(select(Listing).limit(1)).first()
        print(listing)

        print(f"\n--- Sample Flight ---")
        flight = session.exec(select(Flight).limit(1)).first()
        print(flight)

if __name__ == "__main__":
    verify()
