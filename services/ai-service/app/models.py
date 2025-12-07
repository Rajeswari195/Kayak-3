from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class Listing(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    listing_id: str = Field(index=True)
    date: str
    price: float
    availability: int
    amenities: Optional[str] = None
    neighbourhood: Optional[str] = None
    
    # Derived metrics
    avg_30d_price: Optional[float] = None
    is_deal: bool = False
    deal_score: Optional[float] = None

class Flight(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    origin: str = Field(index=True)
    destination: str = Field(index=True)
    airline: str
    stops: int
    duration_minutes: int
    price: float
    departure_date: Optional[str] = None
    
    # Simulating time series / scarcity
    seats_left: Optional[int] = None
    is_promo: bool = False

class Deal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: str # 'flight' or 'hotel'
    source_id: int # PK from Listing or Flight
    destination: str
    price: float
    original_price: Optional[float] = None
    discount_pct: Optional[float] = None
    tags: Optional[str] = None # JSON or comma-separated
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Watch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True) # or session_id
    destination: str
    target_price: float
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
