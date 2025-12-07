from app.database import engine
from sqlmodel import Session
from app.models import Flight
import random

def seed_flight():
    print("--- Seeding Dec 25 Flight ---")
    with Session(engine) as session:
        # Create a specific flight for Christmas
        f = Flight(
            origin="JFK",
            destination="Mumbai",
            airline="Santa Air",
            departure_date="2025-12-25", # The date we want to match
            price=1200.0,
            duration_minutes=900,
            stops=1,
            seats_left=2, # Scarcity!
            is_promo=True # Promo!
        )
        session.add(f)
        session.commit()
        print("✅ Seeded Flight: Santa Air to Mumbai on 2025-12-25")

if __name__ == "__main__":
    seed_flight()
