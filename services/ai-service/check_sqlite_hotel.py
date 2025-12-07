from sqlmodel import Session, select
from app.database import engine
from app.models import Listing

KNOWN_CITIES = ["Mumbai", "Delhi", "Bangalore", "Goa", "Chennai", "Paris", "Tokyo", "London", "Dubai", "New York"]

def check_hotels():
    with Session(engine) as session:
        for city in KNOWN_CITIES:
            # Check for generic match
            l = session.exec(select(Listing).where(Listing.neighbourhood.contains(city)).limit(1)).first()
            if l:
                print(f"FOUND: City='{city}' -> Listing='{l.neighbourhood}' (ID: {l.id})")
                return
    print("NO MATCH FOUND")

if __name__ == "__main__":
    check_hotels()
