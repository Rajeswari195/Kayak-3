from sqlmodel import Session, select, col
from app.database import engine
from app.models import Flight, Listing
from app.agents.concierge_agent import ConciergeAgent

def debug_search():
    print("--- Debugging Search Query ---")
    agent = ConciergeAgent()
    norm_date = agent.normalize_date("december")
    print(f"Normalized Date: '{norm_date}'")
    
    dest = "Mumbai"
    
    with Session(engine) as session:
        # Check raw count
        total = session.exec(select(Flight)).all()
        print(f"Total Flights in DB: {len(total)}")
        
        # Check without date
        stmt = select(Flight).where(Flight.destination.contains(dest))
        res = session.exec(stmt).all()
        print(f"Flights to {dest} (No date): {len(res)}")
        
        # Check WITH date
        if norm_date:
            stmt = stmt.where(col(Flight.departure_date).contains(norm_date))
            res_date = session.exec(stmt).all()
            print(f"Flights to {dest} on {norm_date}: {len(res_date)}")
            
            if not res_date:
                 print("❌ Query returned 0. Checking sample dates...")
                 sample = session.exec(select(Flight).limit(5)).all()
                 for s in sample: 
                     print(f"   Sample: {s.origin}->{s.destination} on {s.departure_date}")

if __name__ == "__main__":
    debug_search()
