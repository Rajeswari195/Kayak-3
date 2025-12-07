from app.database import engine
from sqlmodel import Session, delete
from app.models import Flight, Listing
from app.services.data_ingestion import ingest_data

def reload_db():
    print("--- Reloading DB with Smart Data ---")
    with Session(engine) as session:
        print("Cleaning old data...")
        session.exec(delete(Flight))
        session.exec(delete(Listing))
        session.commit()
        print("Old data deleted.")
        
    print("Ingesting new data...")
    ingest_data(force=True)
    print("✅ DB Reload Complete.")

if __name__ == "__main__":
    reload_db()
