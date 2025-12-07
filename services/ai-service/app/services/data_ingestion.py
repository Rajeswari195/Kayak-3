
import pandas as pd
import os
import random
from sqlmodel import Session, select
from app.database import engine, create_db_and_tables
from app.models import Listing, Flight, Deal


DATA_DIR = "data"
print(f"DEBUG: DATA_DIR absolute path check: {os.path.abspath(DATA_DIR)}")


def ingest_data(force: bool = False):
    create_db_and_tables()
    
    with Session(engine) as session:
        # Check if data already exists
        if not force and session.exec(select(Listing)).first():
            print("Data already exists. Skipping ingestion.")
            return

        print("Starting data ingestion...")
        

        # 1. Ingest Listings (Hotels/Airbnb)
        listings_file = os.path.join(DATA_DIR, "listings.csv")
        if os.path.exists(listings_file):
            print(f"Loading {listings_file}...")
            df = pd.read_csv(listings_file)
            # clean the dataframe first
            df['price'] = pd.to_numeric(df['price'], errors='coerce').fillna(0.0)
            
            for _, row in df.iterrows():
                # Price is safe float now
                # Smart Deals Logic for Hotels
                base_price = float(row.get('price', 0.0))
                # Simulate 30d Avg (Variance between -5% and +30%)
                avg_30d = base_price * random.uniform(0.95, 1.30)
                
                # Deal Flag: If current price is <= 85% of Avg
                is_deal = base_price <= (0.85 * avg_30d)
                
                # Tags/Amenities
                possible_tags = ["Pet-friendly", "Near transit", "Breakfast Included", "Ocean View", "City Center"]
                tags = row.get('room_type', 'Standard') + ", " + ", ".join(random.sample(possible_tags, k=2))

                listing = Listing(
                    listing_id=str(row.get('id', 'unknown')),
                    date="2025-12-01", 
                    price=base_price,
                    availability=int(row.get('availability_365', 0)),
                    neighbourhood=row.get('neighbourhood', 'NYC'),
                    amenities=tags,
                    avg_30d_price=round(avg_30d, 2),
                    is_deal=is_deal,
                    deal_score=random.randint(70, 100) if is_deal else random.randint(40, 70)
                )
                session.add(listing)
        else:
            print("listings.csv not found. Generating MOCK listing data...")
            _generate_mock_listings(session)
            
        # 1.5 Ingest Airbnb India Data (New Request)
        airbnb_file = os.path.join(DATA_DIR, "Airbnb_India_Top_500.csv")
        if os.path.exists(airbnb_file):
            print(f"Loading {airbnb_file}...")
            df_airbnb = pd.read_csv(airbnb_file)
            # Schema: address,isHostedBySuperhost,location/lat,location/lng,name,numberOfGuests,pricing/rate/amount,roomType,stars
            
            count = 0
            for idx, row in df_airbnb.iterrows():
                try:
                    price_val = float(row.get('pricing/rate/amount', 0))
                    if price_val == 0: continue
                    
                    # Extract City from "Manali, Himachal Pradesh, India"
                    raw_addr = str(row.get('address', 'Unknown'))
                    city = raw_addr.split(',')[0].strip()
                    
                    # Smart Logic
                    avg_30d = price_val * random.uniform(0.95, 1.30)
                    is_deal = price_val <= (0.85 * avg_30d)
                    
                    # Tags
                    tags = []
                    if str(row.get('isHostedBySuperhost')) == 'True':
                        tags.append("Superhost")
                    tags.append(str(row.get('roomType', 'Room')))
                    tags.extend(random.sample(["Wifi", "Pool", "Mountain View", "Breakfast", "River View"], k=2))
                    
                    # Use index as ID suffix to avoid collision
                    listing = Listing(
                        listing_id=f"airbnb_in_{idx}",
                        date="2025-12-01",
                        price=price_val,
                        availability=random.randint(5, 365),
                        neighbourhood=city, # Using City as neighbourhood for search
                        amenities=", ".join(tags),
                        avg_30d_price=round(avg_30d, 2),
                        is_deal=is_deal,
                        deal_score=random.randint(80, 100) if is_deal else random.randint(50, 80)
                    )
                    session.add(listing)
                    count += 1
                except Exception as e:
                    print(f"Skipping row {idx}: {e}")
            print(f"Ingested {count} Airbnb India listings.")
 
        # 2. Ingest Flights
        flights_file = os.path.join(DATA_DIR, "flights.csv")
        if os.path.exists(flights_file):
            print(f"Loading {flights_file}...")
            df = pd.read_csv(flights_file)
            
            def parse_stops(val):
                if val == 'zero': return 0
                if val == 'one': return 1
                return 2 # two_or_more
                
            for _, row in df.iterrows():
                # Calculate date based on days_left
                from datetime import datetime, timedelta
                days = int(row.get('days_left', 1))
                dep_date = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
                
                # Smart Deals Logic for Flights
                raw_price = float(0.0 if pd.isna(row.get('price')) else row.get('price', 0))
                
                # 1. Scarcity
                seats = random.randint(1, 60)
                
                # 2. Promo Logic (10% chance)
                is_promo = random.random() < 0.10
                final_price = raw_price
                if is_promo:
                    discount = random.uniform(0.10, 0.25) # 10-25% off
                    final_price = raw_price * (1 - discount)
                
                flight = Flight(
                    origin=row.get('source_city', 'JFK'),
                    destination=row.get('destination_city', 'LHR'),
                    airline=row.get('airline', 'Generic Air'),
                    stops=parse_stops(row.get('stops', 'zero')),
                    duration_minutes=int(float(row.get('duration', 0)) * 60), 
                    price=round(final_price, 2),
                    departure_date=dep_date,
                    seats_left=seats,
                    is_promo=is_promo
                )
                session.add(flight)
        else:
            print("flights.csv not found. Generating MOCK flight data...")
            _generate_mock_flights(session)
            
        session.commit()
        print("Data ingestion complete.")

def _generate_mock_listings(session: Session):
    neighbourhoods = ["Manhattan", "Brooklyn", "Queens", "SoHo", "Williamsburg"]
    amenities_list = ["Wifi, Kitchen", "Pool, Gym", "Pet friendly", "Wifi, Workspace"]
    
    for i in range(50):
        price = random.randint(80, 500)
        listing = Listing(
            listing_id=f"mock_{i}",
            date="2025-12-01",
            price=price,
            availability=random.randint(0, 30),
            neighbourhood=random.choice(neighbourhoods),
            amenities=random.choice(amenities_list),
            avg_30d_price=price * 1.2 # Make it look like a deal sometimes
        )
        session.add(listing)

def _generate_mock_flights(session: Session):
    airlines = ["Delta", "United", "Emirates", "British Airways"]
    routes = [("JFK", "LHR"), ("SFO", "DXB"), ("LAX", "TYO"), ("NYC", "MIA")]
    
    for i in range(50):
        origin, dest = random.choice(routes)
        flight = Flight(
            origin=origin,
            destination=dest,
            airline=random.choice(airlines),
            stops=random.randint(0, 2),
            duration_minutes=random.randint(300, 900),
            price=random.randint(200, 1500),
            seats_left=random.randint(0, 100),
            is_promo=random.choice([True, False])
        )
        session.add(flight)
