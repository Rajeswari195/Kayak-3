-- Seed data for Airports
-- Required for flight creation to resolve IATA codes to IDs.

INSERT INTO airports (
  id,
  iata_code,
  icao_code,
  name,
  city,
  country,
  timezone
) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'JFK', 'KJFK', 'John F. Kennedy International Airport', 'New York', 'United States', 'America/New_York'),
  ('a2222222-2222-2222-2222-222222222222', 'LHR', 'EGLL', 'Heathrow Airport', 'London', 'United Kingdom', 'Europe/London'),
  ('a3333333-3333-3333-3333-333333333333', 'SFO', 'KSFO', 'San Francisco International Airport', 'San Francisco', 'United States', 'America/Los_Angeles'),
  ('a4444444-4444-4444-4444-444444444444', 'LAX', 'KLAX', 'Los Angeles International Airport', 'Los Angeles', 'United States', 'America/Los_Angeles'),
  ('a5555555-5555-5555-5555-555555555555', 'CDG', 'LFPG', 'Charles de Gaulle Airport', 'Paris', 'France', 'Europe/Paris'),
  ('a6666666-6666-6666-6666-666666666666', 'DXB', 'OMDB', 'Dubai International Airport', 'Dubai', 'UAE', 'Asia/Dubai'),
  ('a7777777-7777-7777-7777-777777777777', 'HND', 'RJTT', 'Tokyo Haneda Airport', 'Tokyo', 'Japan', 'Asia/Tokyo'),
  ('a8888888-8888-8888-8888-888888888888', 'SIN', 'WSSS', 'Singapore Changi Airport', 'Singapore', 'Singapore', 'Asia/Singapore');