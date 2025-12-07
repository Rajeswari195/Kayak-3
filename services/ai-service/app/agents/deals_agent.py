
import asyncio
import json
import random
import statistics
from datetime import datetime, timezone
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from sqlmodel import Session, select
from app.database import engine
from app.models import Listing, Flight, Deal

KAFKA_BOOTSTRAP_SERVERS = "localhost:9093"

class DealsAgent:
    def __init__(self):
        self.producer = None
        self.running = False

    async def start(self):
        """Start the Kafka producer and background consumer tasks."""
        self.running = True
        self.producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
        await self.producer.start()
        print("✅ DealsAgent Kafka Producer started")
        
        # Start background tasks
        asyncio.create_task(self.consume_raw_feeds())
        # Simulate ingestion for demo
        asyncio.create_task(self.mock_ingestion_loop())

    async def stop(self):
        self.running = False
        if self.producer:
            await self.producer.stop()

    async def mock_ingestion_loop(self):
        """
        Simulates a live feed by picking REAL data from the DB 
        and mutating it to create 'time-series' events.
        """
        from sqlmodel import Session, select
        from app.database import engine
        from app.models import Flight, Listing
        import random

        # Wait for system to settle
        await asyncio.sleep(5)
        
        while self.running:
            try:
                with Session(engine) as session:
                    # 50% chance of Flight, 50% Hotel
                    if random.random() < 0.5:
                        # Pick a random flight
                        flights = session.exec(select(Flight)).all()
                        if not flights:
                            await asyncio.sleep(5)
                            continue
                        
                        base_item = random.choice(flights)
                        # Simulate Price Fluctuation (Volatile)
                        # Avg price is base_item.price (the "catalog" price)
                        # Current price varies: -25% (promo) to +20% (surge)
                        variance = random.uniform(0.75, 1.2) 
                        current_price = base_item.price * variance
                        
                        raw_event = {
                            "source": "kayak_flights",
                            "type": "flight",
                            "origin": base_item.origin,
                            "destination": base_item.destination,
                            "price": round(current_price, 2),
                            "airline": base_item.airline,
                            "duration": base_item.duration_minutes,
                            "stops": base_item.stops,
                            "avg_30d_price": base_item.price, # simplified
                            "seats_left": random.randint(1, 10),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    else:
                        # Pick a random hotel
                        listings = session.exec(select(Listing)).all()
                        if not listings:
                            await asyncio.sleep(5)
                            continue
                            
                        base_item = random.choice(listings)
                        variance = random.uniform(0.70, 1.3)
                        current_price = base_item.price * variance
                        
                        raw_event = {
                            "source": "airbnb_listings",
                            "type": "hotel",
                            "destination": base_item.neighbourhood, # Use hood as city proxy
                            "price": round(current_price, 2),
                            "name": base_item.listing_id, # using ID/Name
                            "amenities": base_item.amenities or "WiFi,Pool",
                            "avg_30d_price": base_item.price,
                            "availability": random.randint(0, 5), # scarcity
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }

                # Produce to 'raw_supplier_feeds'
                await self.producer.send_and_wait(
                    "raw_supplier_feeds", 
                    json.dumps(raw_event).encode('utf-8')
                )
                # print(f"DEBUG: Mock Ingested: {raw_event['type']} to {raw_event.get('destination')}")
            except Exception as e:
                print(f"Error producing raw event: {e}")
            
            await asyncio.sleep(random.randint(2, 5)) # Ingest every few seconds

    async def consume_raw_feeds(self):
        """
        Consumes raw feeds, detects deals using logic:
        Price <= 0.85 * Avg_30d
        """
        consumer = AIOKafkaConsumer(
            "raw_supplier_feeds",
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id="deals_detector"
        )
        await consumer.start()
        try:
            async for msg in consumer:
                data = json.loads(msg.value.decode('utf-8'))
                
                # DEAL LOGIC
                price = data.get('price', 0)
                avg = data.get('avg_30d_price', price)
                
                is_deal = False
                tags = []
                
                # Rule 1: Price Drop
                if price <= 0.85 * avg:
                    is_deal = True
                    discount = int((1 - price/avg) * 100)
                    tags.append(f"{discount}% OFF")
                    
                # Rule 2: Scarcity
                if data.get('seats_left', 10) < 5 or data.get('availability', 10) < 3:
                    tags.append("Selling Fast")
                    
                if is_deal:
                    print(f"💰 DETECTED DEAL: {data.get('destination')} ${price} (Was ${avg})")
                    
                    # Persist
                    # (In a real app, we'd save to a specific 'Deals' table, 
                    # here we rely on the main Flight/Listing tables having data, 
                    # but we EMIT the event for the UI/Alerts)
                    
                    deal_event = {
                        "type": "deal_found",
                        "destination": data.get('destination'),
                        "price": price,
                        "original_price": avg,
                        "tags": tags,
                        "details": f"{data.get('airline', 'Hotel')} - {tags}",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Emit to deal.events (for Main.py alerts)
                    await self.producer.send_and_wait(
                        "deal.events",
                        json.dumps(deal_event).encode('utf-8')
                    )

        except Exception as e:
            print(f"Consumer failed: {e}")
        finally:
            await consumer.stop()

    def _persist_deal(self, data):
        """Save deal to SQLite for search/history"""
        try:
            with Session(engine) as session:
                # Naive mapping to Flight model for demo
                # In real app, we'd have a separate raw/deal table or update existing
                # Check if flight exists? Or just insert new 'deal' listing
                # For MVP, let's just ensure it's in the Flight table so Concierge sees it
                if data['type'] == 'flight':
                    f = Flight(
                        origin=data['origin'],
                        destination=data['destination'],
                        airline=data['airline'],
                        price=float(data['price']),
                        stops=0,
                        duration_minutes=600,
                        is_promo=True,
                        departure_date="2025-12-25" # Mock future date
                    )
                    session.add(f)
                    session.commit()
        except Exception as e:
            print(f"DB Persist Error: {e}")

    def get_recommendations(self, destination: str = None, budget: float = None, category: str = None, date: str = None):
        """
        Smart lookup for Concierge (Reads from DB, populated by Kafka consumer)
        category: 'Flight' or 'Hotel' or None (Both)
        date: 'YYYY-MM-DD' or similar string
        """
        from datetime import datetime, timedelta
        
        # Normalize date if possible (very basic for now)
        target_date = None
        if date:
            # Try to handle "December 25th" -> simplistic logic or assume "YYYY-MM-DD"
            # For this MVP, we rely on the seed data being YYYY-MM-DD. 
            # If user says "Dec 25", NLU might have normalized it or kept it raw.
            # We'll do a basic substring match if it's not a standard date object
            pass

        with Session(engine) as session:
            recommendations = []
            
            # 1. Search Flights
            if category is None or category == 'Flight':
                limit = 20 if category == 'Flight' else 10 # Increased from 5 to 10 for mixed
                f_query = select(Flight)
                if destination:
                    f_query = f_query.where(Flight.destination.contains(destination))
                if budget:
                    f_query = f_query.where(Flight.price <= budget)
                
                # DATE LOGIC
                if date:
                    # Parse date to remove manual year text if any? No, date passed here is already Normalized YYYY-MM-DD
                    # Use LIKE for flexibility (e.g. 2025-12 match 2025-12-25)
                    # OR strict match if it looks like full date
                    print(f"DEBUG: Searching Flights for Date: {date}")
                    
                    search_date = date
                    f_query = f_query.where(Flight.departure_date.contains(search_date))
                    
                    # Store query for fallback usage
                    # Note: We execute and check count
                    flights = session.exec(f_query.limit(limit)).all()
                    
                    if not flights:
                         print(f"DEBUG: No exact flights for {date}. Trying +/- 3 days fallback...")
                         # Fallback: Parse YYYY-MM-DD and search range?
                         # For MVP, simpler fallback: Search same Month?
                         # Or simply return general results for destination but flag dates?
                         # Let's try searching just the Year-Month part
                         try:
                             if len(date) >= 7: # YYYY-MM
                                 ym = date[:7]
                                 f_query_fallback = select(Flight)
                                 if destination: f_query_fallback = f_query_fallback.where(Flight.destination.contains(destination))
                                 f_query_fallback = f_query_fallback.where(Flight.departure_date.contains(ym))
                                 flights = session.exec(f_query_fallback.limit(limit)).all()
                         except:
                             pass
                else:
                    f_query = f_query.order_by(Flight.price)
                    flights = session.exec(f_query.limit(limit)).all()
                
                # FALLBACK: If date provided but no flights, search +/- 3 days?
                # or just search generally and sort by date?
                if not flights and date:
                     # Relax date constraint
                     print("DEBUG: No flights found for exact date. Searching general availability.")
                     f_query_relaxed = select(Flight)
                     if destination: f_query_relaxed = f_query_relaxed.where(Flight.destination.contains(destination))
                     if budget: f_query_relaxed = f_query_relaxed.where(Flight.price <= budget)
                     f_query_relaxed = f_query_relaxed.order_by(Flight.price)
                     flights = session.exec(f_query_relaxed.limit(limit)).all()
                
                for f in flights:
                    recommendations.append({
                        "type": "Flight",
                        "id": f.id,
                        "origin": f.origin,
                        "destination": f.destination,
                        "price": f.price,
                        "airline": f.airline,
                        "duration": f.duration_minutes,
                        "stops": f.stops,
                        "departure_time": f.departure_date or "N/A",
                        "seats_left": f.seats_left,
                        "is_promo": f.is_promo
                    })

            # 2. Search Hotels (Listings)
            if category is None or category == 'Hotel':
                limit = 10 if category == 'Hotel' else 5
                h_query = select(Listing)
                if destination:
                    h_query = h_query.where(Listing.neighbourhood.contains(destination))
                if budget:
                    h_query = h_query.where(Listing.price <= budget)
                
                h_query = h_query.order_by(Listing.price) # Ensure cheapest first
                listings = session.exec(h_query.limit(limit)).all()
                for l in listings:
                    recommendations.append({
                        "type": "Hotel",
                        "id": l.id,
                        "destination": l.neighbourhood,
                        "price": l.price,
                        "airline": "N/A",
                        "amenities": l.amenities,
                        "is_deal": l.is_deal,
                        "avg_30d": l.avg_30d_price
                    })

            return recommendations

    def calculate_fit_score(self, flight, hotel, f_med, h_med, budget=None, amenities: list = None) -> int:
        score = 50 # Base
        
        # 1. Price vs Median (Max 30 pts)
        savings = 0
        if f_med > 0:
            savings += (f_med - flight['price']) / f_med
        if h_med > 0:
            savings += (h_med - hotel['price']) / h_med
            
        # If savings positive, add score
        score += min(30, int(savings * 50)) 
        
        # 2. Amenities (Max 20 pts + Bonus for User Prefs)
        # Simple keyword match
        hotel_amenities = hotel.get('amenities', '').lower()
        if 'wifi' in hotel_amenities: score += 5
        if 'pool' in hotel_amenities: score += 5
        if 'breakfast' in hotel_amenities: score += 5
        if 'spa' in hotel_amenities: score += 5
        
        # Boost for matching user request
        if amenities:
            match_count = 0
            for req in amenities:
                if req.lower() in hotel_amenities:
                    score += 15 # Big boost for explicit user request
                    match_count += 1
            if match_count == len(amenities):
                score += 10 # Perfect match bonus
        
        # 3. Budget adherence (Max 10 pts)
        total = flight['price'] + hotel['price']
        if budget and total <= budget:
            score += 10
            
        return min(100, max(10, score))

    def generate_explanations(self, flight, hotel, f_med, h_med, amenities: list = None) -> dict:
        total = flight['price'] + hotel['price']
        median_total = f_med + h_med
        hotel_amenities = hotel.get('amenities', '').lower()
        airline = flight.get('airline', '').lower()

        reasons = []
        
        # Price Reason - Only show if SIGNIFICANT savings (>10%)
        if median_total > 0 and total < median_total:
            pct = int((1 - total/median_total)*100)
            if pct >= 10:
                reasons.append(f"{pct}% cheaper than average")
        
        # User Preference Match
        if amenities:
            matched = [a for a in amenities if a.lower() in hotel_amenities]
            if matched:
                reasons.append(f"Matches your request: {', '.join(matched)}")
        
        # Flight-based reasons
        if flight.get('stops', 1) == 0:
            reasons.append("Direct flight - no layovers")
        if 'indigo' in airline or 'airasia' in airline:
            reasons.append(f"Popular carrier ({flight.get('airline', 'N/A')})")
        if flight.get('seats_left', 99) < 10:
            reasons.append("High demand - limited availability")
        
        # Hotel-based reasons (diverse amenities)
        if 'superhost' in hotel_amenities:
            reasons.append("Superhost property - highly rated")
        if 'wifi' in hotel_amenities:
            reasons.append("Free WiFi included")
        if 'breakfast' in hotel_amenities:
            reasons.append("Breakfast included")
        if 'pool' in hotel_amenities:
            reasons.append("Pool access for relaxation")
        if 'spa' in hotel_amenities:
            reasons.append("Spa facilities available")
        if 'mountain' in hotel_amenities or 'river' in hotel_amenities or 'ocean' in hotel_amenities:
            reasons.append("Scenic views")
        if 'villa' in hotel_amenities or 'bungalow' in hotel_amenities:
            reasons.append("Private accommodation")
        
        # Fallback if no reasons
        if not reasons:
            reasons.append("Great value option")
            
        watch_out = []
        if flight.get('seats_left', 10) < 5:
            watch_out.append(f"Only {flight['seats_left']} seats left!")
        if not hotel.get('amenities'):
            watch_out.append("Basic amenities")
            
        # Return diverse selection (max 2 unique reasons)
        import random
        unique_reasons = list(set(reasons))  # Remove duplicates
        selected = random.sample(unique_reasons, min(2, len(unique_reasons)))
        
        return {
            "why_this": selected,
            "what_to_watch": watch_out
        }

    def extract_policy_snippets(self, hotel) -> dict:
        # Mocking extraction from description/amenities
        # In real app, we would parse the 'house_rules' or 'description' field
        policies = {}
        amenities = hotel.get('amenities', '').lower()
        
        if 'pet' in amenities or 'dog' in amenities:
            policies['pets'] = "Pets allowed"
        else:
            policies['pets'] = "No pets"
            
        if 'cancel' in amenities:
             policies['cancellation'] = "Free cancellation"
        else:
             policies['cancellation'] = "Non-refundable"
             
        return policies

    def create_bundles(self, destination: str, origin: str = None, date: str = None, budget: float = None, amenities: list = None):
        # 1. Fetch Candidates
        flights = self.get_recommendations(destination=destination, category='Flight', date=date)
        hotels = self.get_recommendations(destination=destination, category='Hotel')
        
        if not flights or not hotels:
            return []
            
        # 2. Stats
        f_prices = [f['price'] for f in flights]
        h_prices = [h['price'] for h in hotels]
        f_med = statistics.median(f_prices) if f_prices else 0
        h_med = statistics.median(h_prices) if h_prices else 0
        
        # 3. Create Bundles (Top 5 x Top 5)
        # Sort by price to get best candidates first
        flights.sort(key=lambda x: x['price'])
        hotels.sort(key=lambda x: x['price'])
        
        candidates_f = flights[:5]
        candidates_h = hotels[:5]
        
        bundles = []
        for f in candidates_f:
            for h in candidates_h:
                total_price = f['price'] + h['price']
                if budget and total_price > budget:
                    continue
                
                # Check Amenities (Soft Filter - Score Penalty if missing? Or Hard Filter?)
                # User Request: "Refine without starting over... preserve earlier context, regenerate options that respect new constraints"
                # Implies Hard Filter for "Refine" -> "Make it pet friendly" means MUST be pet friendly.
                if amenities:
                    hotel_amenities = h.get('amenities', '').lower()
                    # Check if ALL requested amenities are present
                    missing = [a for a in amenities if a.lower() not in hotel_amenities]
                    if missing:
                        continue # Skip this hotel
                
                score = self.calculate_fit_score(f, h, f_med, h_med, budget, amenities)
                explanation = self.generate_explanations(f, h, f_med, h_med, amenities)
                policies = self.extract_policy_snippets(h)
                
                bundles.append({
                    "id": f"b_{f['id']}_{h['id']}",
                    "flight": f,
                    "hotel": h,
                    "total_price": round(total_price, 2),
                    "fit_score": score,
                    "why_this": explanation["why_this"],
                    "what_to_watch": explanation["what_to_watch"],
                    "policies": policies
                })
        
        # Sort by Score Descending
        bundles.sort(key=lambda x: x['fit_score'], reverse=True)
        return bundles[:3]

deals_agent = DealsAgent()
