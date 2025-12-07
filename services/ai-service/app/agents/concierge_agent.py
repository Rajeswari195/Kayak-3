import re
import json
from datetime import datetime
from app.agents.deals_agent import deals_agent

class SimpleNLU:
    """
    A 'Dumb' NLU that uses Regex to extract intent and entities.
    Replaces the LLM.
    """
    def __init__(self):
        # Cache known cities for better matching
        self.known_cities = ["Mumbai", "Delhi", "Bangalore", "Goa", "Chennai", "Paris", "Tokyo", "London", "Dubai", "New York"]

    def extract(self, text: str) -> dict:
        text = text.lower()
        result = {
            "intent": "search", # default
            "destination": None,
            "origin": None,
            "budget": None,
            "dates": None,
            "travelers": None,
            "nights": None,
            "amenities": None
        }
        
        # 1. Detect Intent
        # FIX: Detect "refine" intent when amenity keywords are present (pet, pool, wifi, etc.)
        amenity_keywords = ["pet", "pool", "wifi", "breakfast", "gym", "spa", "parking", "ocean", "mountain", "friendly"]
        has_amenity_keyword = any(kw in text for kw in amenity_keywords)
        
        # PRIORITY ORDER: watch > book > combine > bundle > show_flights > refine > search
        if "watch" in text or "track" in text or "alert" in text:
            result["intent"] = "watch"
        elif "book" in text or "select" in text or "choose" in text or "chose" in text or "go with" in text or "pick" in text:
            result["intent"] = "book"
        elif "bundle" in text or "package" in text or "show bundle" in text:
            result["intent"] = "bundle"
        elif "flight" in text and ("show" in text or "again" in text or "list" in text):
            result["intent"] = "show_flights"
        elif "hotel" in text or "only hotel" in text or has_amenity_keyword:
             result["intent"] = "refine"
             result["airline"] = "hotel" # usage hack
        elif "trip" in text or "plan" in text:
            result["intent"] = "search"
        # NOTE: "show flights" triggers show_flights, not search
            
        # ... (Dest/Budget Logic same) ...
        # 2. Detect Destination (Naive match against known list)
        # Fix: Ensure matched city isn't actually the Origin ("from Mumbai")
        origin_match = re.search(r'\b(from|departing|leaving)\s+(?P<origin>[a-zA-Z\s]+?)(?=\s+(to|for|on)|$)', text)
        found_origin = origin_match.group("origin").strip().lower() if origin_match else ""

        for city in self.known_cities:
            if city.lower() in text:
                # If this city is exactly the origin, ignore it as destination
                if city.lower() == found_origin:
                    continue
                result["destination"] = city
                break # Take first match
                
        # 3. Detect Budget (Regex: $500, 500 dollars, budget 500)
        # Match $1000 or 1000
        budget_match = re.search(r'(\$|budget\s?|under\s?)(?P<amt>\d+)', text)
        if budget_match:
            try:
                result["budget"] = float(budget_match.group("amt"))
            except:
                pass
                
        # 4. Detect Dates (Improved)
        # Strategy A: Look for "on/from/starting" + date
        # Fix: Use word boundaries \b to avoid matching "Option" -> "on"
        # 4. Detect Dates (Improved)
        # Strategy A: Look for "on/from/starting" + date
    # Fix: Use word boundaries \b to avoid matching "Option" -> "on"
    # Fix: Increase capture length to 25 to catch "January 10th 2026"
        date_match = re.search(r'\b(on|from|starting)\b\s+(?P<date>.{4,25})', text)
        if date_match:
             raw = date_match.group("date").split(" to ")[0].split(" for ")[0].strip()
             # Fix for "from London": check if raw is a city
             is_city = False
             for c in self.known_cities:
                 if c.lower() in raw.lower():
                     is_city = True
                     break
             if not is_city:
                  result["dates"] = raw
        
        # Strategy B: Fallback (Month names) - Runs if A failed or was rejected
        if not result["dates"]:
             # Matches: "dec 25", "december 25th", "jan 1", OR "in december"
             # Fix: Allow optional day part AND OPTIONAL YEAR
             months = r"(in\s)?(?P<mon>jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(\s+\d{1,2}(st|nd|rd|th)?)?(\s+\d{4})?"
             fallback_match = re.search(months, text)
             if fallback_match:
                 # Clean up "in " prefix if captured in group 0
                 raw = fallback_match.group(0).replace("in ", "")
                 result["dates"] = raw.strip()
                 
        # 5. Detect Origin (from X)
        origin_match = re.search(r'\b(from|departing|leaving)\s+(?P<origin>[a-zA-Z\s]+?)(?=\s+(to|for|on)|$)', text)
        if origin_match:
             result["origin"] = origin_match.group("origin").strip().title() # Capitalize for UI

        # 6. Detect Travelers (2 adults, 3 people, family of 4)
        # Matches: "2 adults", "3 guests", "family of 4"
        trav_match = re.search(r'(\d+)\s*(adults?|guests?|people|pax|travellers?)|family of\s*(\d+)', text)
        if trav_match:
             # Group 1 or Group 3 (family size)
             count = trav_match.group(1) or trav_match.group(3)
             if count: result["travelers"] = int(count)

        # 7. Detect Nights/Duration
        # Matches: "for 3 nights", "5 days"
        night_match = re.search(r'for\s+(\d+)\s*(nights?|days?)', text)
        if night_match:
             result["nights"] = int(night_match.group(1))

        # 8. Detect Amenities (Keywords)
        known_amenities = ["wifi", "pool", "spa", "pet", "dog", "gym", "breakfast", "parking", "ocean", "sea", "mountain"]
        found_tags = []
        for tag in known_amenities:
            if tag in text:
                found_tags.append(tag)
        if found_tags:
            result["amenities"] = found_tags

        # SPECIAL: Extract Airline for selection if booking
        # "Lets go with Vistara" or "Book bundle 3"
        if result["intent"] == "book":
             # A. Look for "Option X", "Number X", or "Bundle X"
             index_match = re.search(r'(option|number|bundle|#)\s?(?P<idx>\d+)', text)
             if index_match:
                 result["index"] = int(index_match.group("idx"))
             
             # B. Look for Airline Name
             airline_match = re.search(r'(go with|choose|select|book|chose)\s+(?P<airline>\w+)', text)
             if airline_match:
                  # Avoid capturing "Option" as airline if user says "Choose Option"
                  candidate = airline_match.group("airline")
                  if candidate.lower() not in ["option", "number", "flight", "deal"]:
                      result["airline"] = candidate
                      
        return result

class ConciergeAgent:
    def __init__(self):
        self.nlu = SimpleNLU()
        self.nlu = SimpleNLU()
        self.current_context = {
            "destination": None, 
            "origin": None,
            "budget": None, 
            "dates": None, # Used for Flights
            "check_in": None, # Used for Hotels
            "check_out": None, # Used for Hotels
            "travelers": None,
            "nights": None,
            "amenities": None
        }
        self.awaiting_slot = None
        self.last_recommendations = []
        
    def create_bundle(self, destination: str, budget: float, dates: str = None):
        """Creates a Flight + Hotel Bundle."""
        from sqlmodel import Session, select
        from app.database import engine
        from app.models import Flight, Listing
        
        with Session(engine) as session:
            f_query = select(Flight).where(Flight.destination.contains(destination)).limit(3)
            flights = session.exec(f_query).all()
            
            h_query = select(Listing).where(Listing.neighbourhood.contains(destination)).limit(3)
            hotels = session.exec(h_query).all()
            
            bundles = []
            for f in flights:
                for h in hotels:
                    total_price = f.price + (h.price * 3)
                    if budget and total_price > budget: continue
                    
                    # Explanations
                    savings = "15%" # Mock
                    
                    bundles.append({
                        "type": "Bundle",
                        "destination": destination,
                        "total_price": total_price,
                        "details": f"Flight: {f.airline} + Hotel: {h.neighbourhood}",
                        "explanation": f"Why this: Bundle saves ~{savings} vs booking separately.",
                        "flight_id": f.id,
                        "hotel_id": h.id
                    })
                    if len(bundles) >= 2: break
                if len(bundles) >= 2: break
            return bundles

    def set_watch(self, destination: str, target_price: float, user_id: str = "user_123"):
        from sqlmodel import Session
        from app.database import engine
        from app.models import Watch
        with Session(engine) as session:
            watch = Watch(
                user_id=user_id, destination=destination, target_price=target_price
            )
            session.add(watch)
            session.commit()
            return True

    def normalize_date(self, date_str: str) -> str:
        """
        Convert natural language dates (e.g. 'December 25th', 'dec 25') 
        to YYYY-MM-DD SQL format.
        Assuming current/next year.
        """
        if not date_str: return None
        
        # Already correct format?
        if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
            return date_str
            
        try:
            # Basic parsing strategy for typical NLU outputs
            # Clean up suffixes like 'st', 'nd', 'rd', 'th'
            clean = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str.lower())
            
            # Map month names
            months = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
                'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6,
                'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
            }
            
            # Regex 2: Day Month (Year) - CHECK FIRST
            # e.g. "3rd January 2026"
            match_dmy = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?\s*(?P<year>\d{4})?', clean)
            if match_dmy:
                day = int(match_dmy.group(1))
                month_name = match_dmy.group(2)
                year_str = match_dmy.group("year")
                
                month = 0
                for k, v in months.items():
                    if k in month_name:
                         month = v
                         break
                
                if month > 0:
                    y = int(year_str) if year_str else 2025
                    return f"{y}-{month:02d}-{day:02d}"

            # Regex 1: Month Day (Year)
            # e.g. "January 3rd 2026", "Dec 25"
            # Matches: "january" "3"(rd) "2026"(optional)
            # Fix: Use \d{1,2} for day to avoid matching "January 2025" as Month+Day=2025
            match = re.search(r'([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(?P<year>\d{4})?', clean)
            if match:
                month_name = match.group(1)
                day = int(match.group(2))
                year_str = match.group("year")
                
                # Find month num
                month = 0
                for k, v in months.items():
                    if k in month_name:
                         month = v
                         break
                
                if month > 0:
                    y = int(year_str) if year_str else 2025
                    return f"{y}-{month:02d}-{day:02d}"

            # Fallback: Month only ("in December") -> "2025-12" for partial match
            
            # Fallback: Month only ("in December") -> "2025-12" for partial match
            month_only_match = re.search(r'([a-z]+)', clean)
            if month_only_match:
                 m_name = month_only_match.group(1)
                 m_num = 0
                 for k, v in months.items():
                    if k in m_name:
                         m_num = v
                         break
                 if m_num > 0:
                      return f"2025-{m_num:02d}" # YYYY-MM for fuzzy search
            
            # Relative Date Logic ("in 2 weeks", "next weekend")
            from datetime import timedelta
            now = datetime.now()
            
            if "week" in clean:
                # "in 2 weeks", "next week"
                nums = re.findall(r'\d+', clean)
                weeks = int(nums[0]) if nums else 1
                future = now + timedelta(weeks=weeks)
                return future.strftime("%Y-%m-%d")
            
            if "day" in clean:
                nums = re.findall(r'\d+', clean)
                days = int(nums[0]) if nums else 1
                future = now + timedelta(days=days)
                return future.strftime("%Y-%m-%d")

            if "tomorrow" in clean:
                future = now + timedelta(days=1)
                return future.strftime("%Y-%m-%d")
                
        except Exception as e:
            print(f"Date Normalization Error: {e}")
            
        # FIX: Return None if input doesn't look like a valid date (no month name or date pattern)
        months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        if date_str and not any(m in date_str.lower() for m in months) and not re.search(r'\d{1,2}[-/]\d{1,2}', date_str):
            return None
        return date_str

    def process_message(self, message: str, user_token: str = None) -> str:
        extracted = self.nlu.extract(message)
        intent = extracted["intent"] # book, search, refine, watch
        
        # 0. Contextual Slot Filling (Handle implicit answers)
        # If we were waiting for a specific slot, prioritize that over NLU guess
        if self.awaiting_slot == "destination" and not self.current_context.get("destination"):
            # If NLU found a "destination", good. If not, assume the whole text is the city if short
            self.current_context["destination"] = extracted["destination"] or message.strip().title()
            self.awaiting_slot = None
            
        elif self.awaiting_slot == "dates" and not self.current_context.get("dates"):
            # Accept whatever NLU found, OR the raw text if NLU failed (e.g., "In 2 weeks")
            raw_date = extracted["dates"] or message.strip()
            self.current_context["dates"] = raw_date
            self.awaiting_slot = None

        elif self.awaiting_slot == "check_in" and not self.current_context.get("check_in"):
            # Parse answer as Check In date
            # Ensure we use normalized date
            raw = extracted["dates"] or message.strip()
            self.current_context["check_in"] = self.normalize_date(raw)
            self.awaiting_slot = None
            
        elif self.awaiting_slot == "check_out" and not self.current_context.get("check_out"):
            # This could be a date OR "3 nights"
            if "night" in message.lower():
                import re
                try:
                    # ensure imports
                    from datetime import datetime, timedelta
                    
                    matches = re.findall(r'\d+', message)
                    if matches:
                        nights = int(matches[0])
                        # Calculate Check Out
                        if self.current_context.get("check_in"):
                             curr_in = self.current_context["check_in"]
                             # Safe check format
                             try:
                                 d_obj = datetime.strptime(curr_in, "%Y-%m-%d")
                                 d_out = d_obj + timedelta(days=nights)
                                 self.current_context["check_out"] = d_out.strftime("%Y-%m-%d")
                             except:
                                 pass
                        self.current_context["nights"] = nights
                except Exception as e:
                    print(f"Check-out calc error: {e}")
                    pass
            else:
                 # Assume it is a specific date
                 raw = extracted["dates"] or message.strip()
                 self.current_context["check_out"] = self.normalize_date(raw)
            self.awaiting_slot = None
            
        elif self.awaiting_slot == "origin" and not self.current_context.get("origin"):
            # NLU might capture "Delhi" as destination. Recovery:
            candidate = extracted.get("origin") or extracted.get("destination") or message.strip().title()
            # If we already have a main destination "Mumbai", don't overwrite it
            if self.current_context.get("destination") and candidate.lower() == self.current_context["destination"].lower():
                 pass # User repeated dest? Unlikely.
            else:
                 self.current_context["origin"] = candidate
            self.awaiting_slot = None

        elif self.awaiting_slot == "travelers" and not self.current_context.get("travelers"):
             # If NLU didn't find "travelers" (int), try parsing raw
             if extracted["travelers"]:
                 self.current_context["travelers"] = extracted["travelers"]
             else:
                 # Try finding digit in raw text
                 import re
                 d_match = re.search(r'\d+', message)
                 if d_match:
                     self.current_context["travelers"] = int(d_match.group(0))
                 elif "me" in message.lower():
                     self.current_context["travelers"] = 1
             self.awaiting_slot = None
        
        if extracted["destination"] and not self.current_context.get("destination"): 
             self.current_context["destination"] = extracted["destination"]
        # Note: We skip overwriting if already set, to prevent "Delhi" (origin answer) overwriting "Mumbai" (dest)

        if extracted["origin"]: self.current_context["origin"] = extracted["origin"]
        if extracted["budget"]: self.current_context["budget"] = extracted["budget"]
        
        # FIX: Only update dates if NLU found a VALID date (contains month name or digits)
        if extracted["dates"]:
            date_str = extracted["dates"].lower()
            months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            is_valid_date = any(m in date_str for m in months) or re.search(r'\d{1,2}', date_str)
            if is_valid_date:
                self.current_context["dates"] = extracted["dates"]
        
        if extracted["travelers"]: self.current_context["travelers"] = extracted["travelers"]
        if extracted["nights"]: self.current_context["nights"] = extracted["nights"]
        if extracted["amenities"]: self.current_context["amenities"] = extracted["amenities"]
        
        print(f"DEBUG: NLU Intent={intent} Ctx={self.current_context}")

        # Slot Filling: Ask for missing details BEFORE Refine/Search
        # Only trigger attempts to fill if Intent is 'search' or 'refine' 
        # (Skip for book/watch/bundle)
        # SPECIAL: Check-in/Check-out for Hotel Flow
        is_hotel_flow = (
            "hotel" in message.lower() or 
            self.current_context.get("check_in") is not None or
            "amenities" in self.current_context.keys() and self.current_context["amenities"]
        )
        
        if intent in ["search", "refine"] and not self.last_recommendations:
            # 1. Destination check
            if not self.current_context.get("destination"):
                 self.awaiting_slot = "destination"
                 return json.dumps({
                     "text": "I'd love to help! Where are we going?", 
                     "actions": []
                 })

            # 2a. Date check (Flights) OR Check-in (Hotels)
            # If we don't know it's a hotel yet, assume FLIGHT first unless user specified
            if not self.current_context.get("dates") and not self.current_context.get("check_in"):
                 # Ask generic "When" context
                 self.awaiting_slot = "check_in" if is_hotel_flow else "dates" 
                 prompt = f"When are you planning to check in to {self.current_context['destination']}?" if is_hotel_flow else f"When are you planning to visit {self.current_context['destination']}?"
                 return json.dumps({
                     "text": prompt,
                     "actions": []
                 })
            
            # 2b. Check-out (Hotels Only)
            if is_hotel_flow and self.current_context.get("check_in") and not self.current_context.get("check_out"):
                 self.awaiting_slot = "check_out"
                 return json.dumps({
                     "text": "And when will you be checking out?",
                     "actions": []
                 })
            
            # 3. Origin check (Flights Only - Skip if Hotel)
            if not is_hotel_flow and not self.current_context.get("origin"):
                 self.awaiting_slot = "origin"
                 return json.dumps({
                     "text": "Great! Where will you be flying from?",
                     "actions": []
                 })
                 
            # 4. Travelers check
            if not self.current_context.get("travelers"):
                 self.awaiting_slot = "travelers"
                 return json.dumps({
                     "text": "How many people are traveling?",
                     "actions": ["Just me", "2 Adults", "Family of 4"]
                 })

        # SPECIAL: Skip Origin logic if user said "Skip"
        if extracted.get("origin") == "Skip":
            self.current_context["origin"] = "Unknown"

        # NEW: Bundle Intent - Show bundles with FULL details
        if intent == "bundle":
            dest = self.current_context.get("destination")
            if not dest:
                return "I'd love to show you bundles! Where are you going?"
            
            bundles = deals_agent.create_bundles(
                destination=dest,
                date=self.current_context.get("dates"),
                budget=self.current_context.get("budget"),
                amenities=self.current_context.get("amenities")
            )
            
            if bundles:
                self.last_recommendations = bundles
                resp = f"📦 **Flight+Hotel Bundles for {dest}:**\n\n"
                for i, b in enumerate(bundles):
                    resp += f"**Bundle {i+1}:**\n"
                    resp += f"   - ✈️ Flight: {b['flight'].get('airline','N/A')} (${b['flight'].get('price', 0)})\n"
                    resp += f"   - 🏨 Hotel: {b['hotel'].get('destination','N/A')} (${b['hotel'].get('price', 0)}/night)\n"
                    resp += f"   - 💰 **Total: ${b['total_price']}**\n"
                    resp += f"   - 🎯 Fit Score: **{b['fit_score']}/100**\n"
                    resp += f"   - ✅ Why This: {', '.join(b['why_this'])}\n"
                    if b['what_to_watch']:
                        resp += f"   - ⚠️ Watch Out: {', '.join(b['what_to_watch'])}\n"
                    resp += f"   - 📋 Policies: {b['policies']}\n\n"
                resp += "Say 'Book bundle 1' to confirm!"
                return resp
            else:
                return f"No bundles found for {dest}. Try 'Show me hotels' or 'Show me flights' first."



        # NEW: Show Flights Intent - Direct display without "running search" message
        if intent == "show_flights":
            dest = self.current_context.get("destination")
            if not dest:
                return "I'd love to show you flights! Where are you going?"
            
            flights = deals_agent.get_recommendations(
                destination=dest,
                budget=self.current_context.get("budget"),
                category='Flight',
                date=self.current_context.get("dates")
            )
            self.last_recommendations = flights if flights else []
            
            if not flights:
                return f"No flights found to {dest}."
            
            resp = f"✈️ **Flights to {dest}:**\n\n"
            for i, d in enumerate(flights[:10]):
                is_deal = d.get('is_deal') or d.get('is_promo') or (d.get('price', 9999) < 300)
                deal_tag = "🔥 DEAL! " if is_deal else ""
                seats = d.get('seats_left', 99)
                scarcity = f" ⚠️ Only {seats} seats left!" if seats < 10 else ""
                resp += f"{i+1}. {deal_tag}{d.get('airline', 'Flight')} - ${d['price']}{scarcity}\n"
                resp += f"   Departs: {d.get('departure_date', d.get('departure_time', 'N/A'))}\n"
            return resp

        # SPECIAL: Refine / Filter Logic (e.g. "How about hotels?")
        if intent == "refine":
            # Preservation Logic: Refine preserves 'destination' and 'dates' from previous turn if not explicit
            if not self.current_context["destination"] and self.last_recommendations:
                 # Try to recover from last rec or assume same session
                 pass
            
            dest = self.current_context.get("destination")
            budget = self.current_context.get("budget")
            amenities = self.current_context.get("amenities")
            
            if not dest:
                 # Fallback: Check if we have context from last successful search
                 return "I'd love to refine the search, but could you remind me where we are going?"

            # Determine Strategy: Bundle vs Flight/Hotel
            # If "amenities" provided or "hotel" keyword, prioritize Hotel-based Bundle refinement
            is_bundle = "bundle" in message.lower() or (self.current_context["amenities"] and "flight" not in message.lower())
            
            if is_bundle:
                 bundles = deals_agent.create_bundles(
                     destination=dest, 
                     date=self.current_context.get("dates"), 
                     budget=budget,
                     amenities=amenities
                 )
                 if bundles:
                     self.last_recommendations = bundles # Cache for booking
                     resp = f"I've refined your options for {dest} (filtering for {', '.join(amenities or [])}):\n\n"
                     for i, b in enumerate(bundles):
                         tags = f"Matched: {', '.join(amenities)}" if amenities else ""
                         details = f"Flight: {b['flight'].get('airline','N/A')} + Hotel: {b['hotel'].get('destination','N/A')}"
                         resp += f"{i+1}. 📦 Bundle: {details} - ${b['total_price']}\n   Explain: {b['why_this'][0]}\n   {tags}\n"
                     return resp
            
            # Fallback to standard search if not bundle
            target_type = "Hotel" if "hotel" in message.lower() or amenities else "Flight"
            
            # Fetch new recommendations from Deals Agent with Category filter
            # Parse date for Agent Search too if needed (DealsAgent handles simple strings but cleaner to normalize)
            search_date = self.normalize_date(self.current_context.get("dates"))
            new_recs = deals_agent.get_recommendations(
                destination=dest, 
                budget=budget, 
                category=target_type,
                date=search_date or self.current_context.get("dates")
            )
            self.last_recommendations = new_recs
            
            if not new_recs:
                return f"I couldn't find any {target_type}s for {dest} with those filters. Shall I try a new search?"
            
            resp = f"Here are the {target_type}s for {dest}:\n\n"
            for i, d in enumerate(new_recs[:10]):
                # Deal Check (Legacy + Smart)
                is_deal = d.get('is_deal') or d.get('is_promo') or (d.get('price', 9999) < 300)
                deal_tag = "🔥 DEAL! " if is_deal else ""
                
                if target_type == 'Hotel':
                     tags = d.get('amenities', '')
                     # Highlight matches
                     if amenities:
                         matches = [a for a in amenities if a.lower() in tags.lower()]
                         if matches: deal_tag += f"✅ Matches {', '.join(matches)} "
                     
                     resp += f"{i+1}. {deal_tag}🏨 {d.get('destination', 'Hotel')} - ${d['price']}\n"
                     if tags: resp += f"   Tags: {tags}\n"
                else:
                     seats = d.get('seats_left', 99)
                     scarcity = f" (Only {seats} seats left!)" if seats < 10 else ""
                     resp += f"{i+1}. {deal_tag}✈️ {d.get('airline', 'Flight')} - ${d['price']}{scarcity}\n"
                     
            return resp

        # A. Watch Logic (Immediate)
        if intent == "watch":
            dest = self.current_context["destination"]
            budget = self.current_context["budget"]
            
            if not dest:
                return "Which city should I track for you?"
            
            if not budget:
                # Ask for budget constraint if missing
                # self.awaiting_slot = "budget" # TODO: Implement Budget Slot
                budget = 2000 # Default
                
            self.set_watch(dest, budget)
            return f"👀 Watch Set!\n\nI'm tracking {dest} packages for drops below ${budget}. I'll alert you instantly!"


        # B. Booking Logic & quote Generation
        # Allow booking if user_token OR for Demo Mode (if recommendation exists)
        if intent == "book" and self.last_recommendations:
             selected_item = self.last_recommendations[0] # Default first
             
             # 1. Select by Index
             if extracted.get("index"):
                 idx = extracted["index"] - 1
                 if 0 <= idx < len(self.last_recommendations):
                     selected_item = self.last_recommendations[idx]
             
             # QUOTE GENERATION (Pre-booking confirmation)
             # If user says "Quote" or just "Book", for refined UX we might show Quote first?
             # For now, let's just output the Quote success message directly as requested.
             
             # Helper to format Quote
             def generate_quote(item):
                 base = item.get('total_price', item.get('price'))
                 tax = base * 0.12
                 fees = 25.00
                 total = base + tax + fees
                 
                 q = {
                     "Base Fare/Rate": f"${base:.2f}",
                     "Taxes (12%)": f"${tax:.2f}",
                     "Booking Fees": f"${fees:.2f}",
                     "Total Estimate": f"${total:.2f}",
                     "Cancellation": item.get('policies', {}).get('cancellation', "Partially Refundable")
                 }
                 return q

             # Dispatch based on Type
             quote = generate_quote(selected_item)
             quote_str = "\n".join([f"   - {k}: {v}" for k,v in quote.items()])

             if selected_item.get('flight') and selected_item.get('hotel'): # Bundle
                  # PERSIST Bundle to MySQL (Book Flight + Hotel)
                  details = f"Flight: {selected_item['flight'].get('airline','N/A')} + Hotel: {selected_item['hotel'].get('destination','N/A')}"
                  import uuid
                  
                  try:
                      # NORMALIZE DATE for SQL
                      norm_date = self.normalize_date(self.current_context.get('dates'))
                      
                      # Book the Flight
                      flight_data = selected_item['flight'].copy()
                      flight_data['date'] = norm_date
                      self.book_flight(flight_data, user_token or "demo-token")
                      
                      # Book the Hotel
                      hotel_data = selected_item['hotel'].copy()
                      hotel_data['date'] = norm_date
                      self.book_hotel(hotel_data, user_token or "demo-token")
                      
                      return (f"✅ **Booking Confirmed!**\n\n"
                              f"📦 **Bundle**: {details}\n"
                              f"💳 **Invoice**:\n{quote_str}\n\n"
                              f"Confirmation #B-{str(uuid.uuid4())[:8].upper()}")
                  except Exception as e:
                      return f"❌ Bundle Booking failed: {str(e)}"

             elif selected_item.get('type') == 'Flight' or selected_item.get('airline'):
                 try:
                     self.book_flight(selected_item, user_token or "demo-token")
                     return (f"✅ **Flight Confirmed!**\n\n"
                             f"✈️ **{selected_item.get('airline')}** to {selected_item.get('destination')}\n"
                             f"💳 **Invoice**:\n{quote_str}")
                 except Exception as e:
                     return f"❌ Flight Booking failed: {str(e)}"
             
             elif selected_item.get('type') == 'Hotel' or selected_item.get('neighbourhood'):
                 try:
                     self.book_hotel(selected_item, user_token or "demo-token")
                     return (f"✅ **Hotel Confirmed!**\n\n"
                             f"🏨 **{selected_item.get('destination')}** (ID: {selected_item.get('id')})\n"
                             f"💳 **Invoice**:\n{quote_str}")
                 except Exception as e:
                     return f"❌ Hotel Booking failed: {str(e)}"
                     
        # C. Search / Bundle Logic
        
        # Missing Info Check
        if not self.current_context["dates"]:
             if self.current_context["destination"]:
                 return f"I see you want to go to {self.current_context['destination']}. When are you planning to travel?"
             else:
                 return "Where would you like to go?"

        # Search Simulation (WAIT Logic)
        if "wait" not in message.lower():
             return f"Okay! So you're looking for a trip to {self.current_context['destination']} on {self.current_context['dates']}.\n\nI'm running a quick search now, and will let you know what I find! [WAIT]"


        # If we fall through (shouldn't happen with WAIT/Followup architecture), return fallback
        return "Please wait..."

    # ... (existing book_flight) ...

    def book_hotel(self, hotel_data, auth_token):
        """
        Syncs hotel to MySQL and Creates Booking (Demo Only).
        """
        import pymysql
        import uuid
        
        DEMO_USER_EMAIL = "akshay.menon@usa.com"
        
        try:
            conn = pymysql.connect(
                host='localhost',
                user='kayak_user',
                password='kayak_pass',
                database='kayak_core',
                port=3306,
                cursorclass=pymysql.cursors.DictCursor
            )
            with conn.cursor() as cursor:
                # 1. Sync Hotel
                # Use hotel_id if present, else generate
                h_id = str(hotel_data.get('id'))
                cursor.execute("SELECT id FROM hotels WHERE id = %s", (h_id,))
                if not cursor.fetchone():
                    # Insert minimal hotel record
                    cursor.execute("""
                        INSERT INTO hotels (id, name, address_line1, city, state, zip, country, base_price_per_night, currency, is_active, created_at, updated_at)
                        VALUES (%s, %s, '123 Beach Rd', %s, 'Unknown', '00000', 'Unknown', %s, 'USD', 1, NOW(), NOW())
                    """, (h_id, f"Hotel in {hotel_data.get('destination')}", hotel_data.get('destination'), float(hotel_data.get('price', 100))))
                    conn.commit()

                # Find User ID
                user_id = None
                
                # A. Try Auth Token (Real User)
                if auth_token and auth_token != "demo-token":
                    try:
                        import jwt
                        decoded = jwt.decode(auth_token, options={"verify_signature": False})
                        # Check typical claims
                        user_id = decoded.get("id") or decoded.get("userId") or decoded.get("sub")
                        print(f"DEBUG: Hotel Booking for Real User ID: {user_id}")
                    except Exception as e:
                        print(f"WARN: Token decode failed {e}")

                # B. Fallback to Demo User
                if not user_id:
                    cursor.execute("SELECT id FROM users WHERE email = %s", (DEMO_USER_EMAIL,))
                    user_rec = cursor.fetchone()
                    if user_rec:
                        user_id = user_rec['id']
                        print(f"DEBUG: Hotel Booking for Demo User ID: {user_id}")

                if user_id:
                    booking_id = str(uuid.uuid4())
                    
                    # 3. Create Booking
                    ref = f"BK-H-{str(uuid.uuid4())[:6].upper()}"
                    
                    # Determine Dates (Use injected 'date' from context or fallback)
                    start_date = hotel_data.get('date')
                    if start_date:
                        date_val = f"'{start_date}'"
                        end_date_val = f"DATE_ADD('{start_date}', INTERVAL 3 DAY)"
                    else:
                        date_val = "NOW()"
                        end_date_val = "DATE_ADD(NOW(), INTERVAL 3 DAY)" # Fallback

                    cursor.execute(f"""
                        INSERT INTO bookings (
                            id, user_id, booking_reference, status, total_amount, currency, 
                            start_date, end_date, created_at, updated_at
                        )
                        VALUES (
                            %s, %s, %s, 'confirmed', %s, 'USD', 
                            {date_val}, {end_date_val}, 
                            NOW(), NOW()
                        )
                    """, (booking_id, user_id, ref, float(hotel_data.get('price', 100))))
                    
                    # 4. Create Booking Item
                    item_id = str(uuid.uuid4())
                    price = float(hotel_data.get('price', 100))
                    cursor.execute(f"""
                        INSERT INTO booking_items (
                            id, booking_id, item_type, hotel_id, quantity, unit_price, total_price, currency, 
                            start_date, end_date, created_at, updated_at
                        )
                        VALUES (
                            %s, %s, 'HOTEL', %s, 1, %s, %s, 'USD', 
                            {date_val}, {end_date_val},
                            NOW(), NOW()
                        )
                    """, (item_id, booking_id, h_id, price, price))
                    
                    conn.commit()
                    print(f"DEBUG: Demo Hotel Booking Created: {ref}")
                    return {"id": booking_id, "status": "confirmed", "reference": ref}
            conn.close()
        except Exception as e:
            print(f"Hotel Booking Error: {e}")
            raise e
        


    def generate_followup(self) -> str:
        """
        Executed by Main after the [WAIT] delay.
        Performs the ACTUAL search.
        """
        dest = self.current_context.get("destination")
        dates = self.current_context.get("dates")
        budget = self.current_context.get("budget")
        
        if not dest or not dates:
             return "I apologize, I lost the details. Where were we going?"


             
        # 2. Flights
        deals = deals_agent.get_recommendations(
            destination=dest, 
            budget=budget,
            date=self.current_context.get("dates")
        )
        self.last_recommendations = deals if deals else []
        
        if not deals:
            return f"No flights found to {dest}."
            
        resp = f"Here are the top deals for {dest}:\n\n"
        for i, d in enumerate(deals[:10]):
            # Fit Score
            bg = budget or 20000
            score = 100
            if d['price'] > bg: score -= 50
            
            # Smart Deal Logic
            is_deal = d.get('is_deal') or d.get('is_promo') or (d['price'] < 300)
            deal_tag = "🔥 DEAL! " if is_deal else ""
            
            if d.get('type') == 'Hotel':
                resp += f"{i+1}. {deal_tag}🏨 {d.get('destination', 'Hotel')} - ${d['price']}\n"
                if d.get('amenities'):
                    resp += f"   Tags: {d.get('amenities')}\n"
                if d.get('avg_30d'):
                     resp += f"   (Avg 30d: ${d.get('avg_30d', 0)})\n"
                resp += f"   Type: Hotel Stay\n"
            else:
                seats = d.get('seats_left', 99)
                scarcity = f" ⚠️ Only {seats} seats left!" if seats < 10 else ""
                resp += f"{i+1}. {deal_tag}✈️ {d.get('airline', 'Flight')} - ${d['price']}{scarcity}\n"
                resp += f"   Departs: {d.get('departure_time', 'N/A')}\n"
            
            resp += f"   Score: {score}/100 match\n"
            
        return resp

    def book_flight(self, flight_data, auth_token):
        """
        Syncs flight to MySQL and Creates Booking (Demo Mode Support).
        """
        import pymysql
        import requests
        import uuid
        
        # DEMO MODE USER (Fallback)
        DEMO_USER_EMAIL = "akshay.menon@usa.com"
        
        # 1. Sync flight to MySQL to ensure it exists
        try:
            conn = pymysql.connect(
                host='localhost',
                user='kayak_user',
                password='kayak_pass',
                database='kayak_core',
                port=3306,
                cursorclass=pymysql.cursors.DictCursor
            )
            
            def ensure_airport(cursor, city):
                # 1. Check by City
                cursor.execute("SELECT id FROM airports WHERE city = %s LIMIT 1", (city,))
                res = cursor.fetchone()
                if res: return res['id']
                
                # 2. Check by IATA to avoid Unique Key Failure
                iata = city[:3].upper()
                cursor.execute("SELECT id FROM airports WHERE iata_code = %s LIMIT 1", (iata,))
                res = cursor.fetchone()
                if res: return res['id']
                
                # 3. Insert New
                new_id = str(uuid.uuid4())
                cursor.execute("INSERT INTO airports (id, iata_code, name, city, country, created_at, updated_at) VALUES (%s, %s, %s, %s, 'Unknown', NOW(), NOW())", (new_id, iata, f"{city} Airport", city))
                conn.commit()
                return new_id

            with conn.cursor() as cursor:
                # A. Enasure Flight Entitites
                origin_id = ensure_airport(cursor, flight_data.get('origin', 'Unknown'))
                dest_id = ensure_airport(cursor, flight_data.get('destination', 'Unknown'))
                
                cursor.execute("SELECT id FROM flights WHERE id = %s", (flight_data['id'],))
                if not cursor.fetchone():
                    # Sync
                    sql_insert = """
                    INSERT INTO flights (
                        id, flight_number, airline, origin_airport_id, destination_airport_id, 
                        departure_time, arrival_time, total_duration_minutes, stops, 
                        base_price, currency, seats_available, is_active, created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, NOW(), DATE_ADD(NOW(), INTERVAL 120 MINUTE), 120, 0, %s, 'USD', 100, 1, NOW(), NOW())
                    """
                    cursor.execute(sql_insert, (
                        flight_data['id'],
                        f"AI-{str(uuid.uuid4())[:4]}",
                        flight_data.get('airline', 'Unknown'),
                        origin_id,
                        dest_id,
                        float(flight_data.get('price', 100))
                    ))
                    conn.commit()
                    
                # B. EXECUTE BOOKING (Direct to DB for Demo/Pilot)
                # If we are here, we likely don't have a valid JWT for the user in this No-API mode.
                # So we manually insert the booking for 'aksahy.menon@usa.com'
                
                # 2. Find User
                user_id = None
                
                # A. Try Auth Token (Real User)
                if auth_token and auth_token != "demo-token":
                    try:
                        import jwt
                        # Decode payload 
                        decoded = jwt.decode(auth_token, options={"verify_signature": False})
                        user_id = decoded.get("id") or decoded.get("userId") or decoded.get("sub")
                        print(f"DEBUG: Flight Booking for Real User ID: {user_id}")
                    except Exception as e:
                        print(f"WARN: Token decode failed {e}")

                # B. Fallback to Demo User
                if not user_id:
                    cursor.execute("SELECT id FROM users WHERE email = %s", (DEMO_USER_EMAIL,))
                    user_rec = cursor.fetchone()
                    if user_rec:
                        user_id = user_rec['id']
                        print(f"DEBUG: Flight Booking for Demo User ID: {user_id}")

                if user_id:
                    booking_id = str(uuid.uuid4())
                    
                    # Determine Date
                    dep_date = flight_data.get('departure_time')
                    # Parse date if possible, else fallback to NOW()
                    if dep_date and dep_date != "N/A":
                        # If date string is YYYY-MM-DD
                        date_val = f"'{dep_date}'"
                        end_date_val = f"DATE_ADD('{dep_date}', INTERVAL 1 DAY)"
                    else:
                        date_val = "NOW()"
                        end_date_val = "DATE_ADD(NOW(), INTERVAL 1 DAY)"

                    # Insert Booking
                    sql_book = f"""
                    INSERT INTO bookings (
                        id, user_id, booking_reference, status, total_amount, currency, 
                        start_date, end_date, created_at, updated_at
                    ) VALUES (%s, %s, %s, 'confirmed', %s, 'USD', {date_val}, {end_date_val}, NOW(), NOW())
                    """
                    ref = f"BK-{str(uuid.uuid4())[:6].upper()}"
                    cursor.execute(sql_book, (booking_id, user_id, ref, float(flight_data['price'])))
                    
                    # Insert Booking Line Item (Flight)
                    sql_item = f"""
                    INSERT INTO booking_items (
                        id, booking_id, item_type, flight_id, quantity, unit_price, total_price, currency, 
                        start_date, end_date, created_at, updated_at
                    ) VALUES (%s, %s, 'FLIGHT', %s, 1, %s, %s, 'USD', {date_val}, {end_date_val}, NOW(), NOW())
                    """
                    item_id = str(uuid.uuid4())
                    price = float(flight_data['price'])
                    cursor.execute(sql_item, (item_id, booking_id, flight_data['id'], price, price))
                    
                    conn.commit()
                    print(f"DEBUG: Demo Booking Created for {DEMO_USER_EMAIL} (Ref: {ref})")
                    return {"id": booking_id, "status": "confirmed", "reference": ref}
                    
            conn.close()
        except Exception as e:
            print(f"Booking Error: {e}")
            raise e
            
        # Fallback to API if we didn't return above (which we should have)
        return {"status": "error", "message": "Booking logic failed"}
