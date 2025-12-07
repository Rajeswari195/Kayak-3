from app.services.data_ingestion import ingest_data
from app.database import engine
from sqlmodel import Session, select
from app.models import Listing

def run():
    print("--- 1. Ingesting CSV Data (forcing update) ---")
    # This loads listings.csv (Albany) and flights.csv
    ingest_data(force=True)
    
    print("\n--- 2. Ensuring Mumbai Test Data Exists ---")
    with Session(engine) as session:
        # Check for Mumbai
        mumbai_hotel = session.exec(select(Listing).where(Listing.neighbourhood == "Mumbai")).first()
        if not mumbai_hotel:
            print("Mumbai hotel missing. Seeding...")
            hotel = Listing(
                listing_id="9990001",
                date="2025-12-07",
                price=250.0,
                availability=5,
                amenities="Pool,WiFi,Spa",
                neighbourhood="Mumbai", 
                avg_30d_price=250.0,
                is_deal=False
            )
            session.add(hotel)
            session.commit()
            print("✅ Mumbai Hotel Seeded.")
        else:
            print(f"✅ Mumbai Hotel exists (ID: {mumbai_hotel.id}).")

if __name__ == "__main__":
    run()
