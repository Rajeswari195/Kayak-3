from app.database import engine
from sqlmodel import Session
from app.models import Listing
import random

def seed_hotel():
    print("--- Seeding Smart Hotel ---")
    with Session(engine) as session:
        h = Listing(
            listing_id="smart_hotel_1",
            date="2025-12-01",
            price=150.0,
            availability=365,
            neighbourhood="Mumbai",
            amenities="Wifi, Pool, Pet-friendly", # Tags
            avg_30d_price=300.0, # High avg
            is_deal=True, # Explicitly a deal (150 < 300)
            deal_score=95
        )
        session.add(h)
        session.commit()
        print("✅ Seeded Hotel: Smart Stay Mumbai ($150 vs Avg $300)")

if __name__ == "__main__":
    seed_hotel()
