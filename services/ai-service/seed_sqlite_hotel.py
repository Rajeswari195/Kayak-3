from sqlmodel import Session
from app.database import engine
from app.models import Listing
import random

def seed_hotel():
    with Session(engine) as session:
        # Check if already exists
        # NOTE: Using 'Mumbai' as neighbourhood for simplicity in NLU matching
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
        print(f"Seeded Hotel: Mumbai (ID: {hotel.id}, ListingID: 9990001)")

if __name__ == "__main__":
    seed_hotel()
