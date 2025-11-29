/*
 * @file 001-init-core-tables.sql
 * @description
 * Initial MySQL schema for core entities in the Kayak-like travel platform.
 *
 * Scope:
 * - Users (travelers and potential admins)
 * - Admins (admin-specific metadata linked to users)
 * - Airports (for flight origin/destination)
 * - Hotels (top-level hotel records)
 * - Hotel rooms (room types and inventory per hotel)
 * - Cars (rental car listings)
 * - Flights (flight schedule and pricing)
 *
 * Key design choices:
 * - All primary keys are CHAR(36) and intended to store UUID strings.
 * - Every table includes `created_at` and `updated_at` columns with
 *   millisecond precision and automatic update on modification.
 * - Foreign keys use InnoDB with `ON DELETE CASCADE` where appropriate
 *   so that dependent records are cleaned up when parents are removed.
 * - Indexes are created on common query patterns (city, dates, price,
 *   SSN-like user_id, email, IATA codes, etc.).
 *
 * Assumptions:
 * - MySQL 8.x with InnoDB and utf8mb4 encoding.
 * - Database (schema) has already been created and selected (e.g.,
 *   `CREATE DATABASE kayak_core; USE kayak_core;`) before running this file.
 *
 * Notes:
 * - Application-level validation (SSN regex, US state/ZIP validation,
 *   phone/email normalization) is enforced in the Node.js core-api layer.
 *   The DB layer stores normalized strings and enforces uniqueness and
 *   referential integrity.
 */

-- BEGIN WRITING FILE CODE

-- Use a consistent SQL mode and character set for the session.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Table: users
-- ---------------------------------------------------------------------------
-- Stores end-user accounts (travelers) and optionally flags for admin roles.
-- The `user_id` column stores the SSN-style identifier (e.g., 123-45-6789).
-- Uniqueness on `user_id` and `email` is enforced at the database level.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  user_id VARCHAR(11) NOT NULL COMMENT 'SSN-format User ID (validated in app layer)',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(64) NOT NULL COMMENT 'US state name or two-letter abbreviation (validated in app layer)',
  zip VARCHAR(16) NOT NULL COMMENT 'US ZIP or ZIP+4 (validated in app layer)',
  country VARCHAR(64) NOT NULL DEFAULT 'United States',
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(254) NOT NULL,
  profile_image_url VARCHAR(512) NULL,
  password_hash VARCHAR(255) NOT NULL COMMENT 'BCrypt or similar hash; never store plaintext passwords',
  payment_method_token VARCHAR(128) NULL COMMENT 'Opaque token/reference to stored payment method',
  payment_brand VARCHAR(32) NULL COMMENT 'e.g., VISA, MASTERCARD, PAYPAL',
  payment_last4 CHAR(4) NULL COMMENT 'Last 4 digits of card number (if applicable)',
  is_admin TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Convenience flag: 1 if this user has admin privileges',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Soft-delete / suspension flag',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_user_id (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_city_state (city, state),
  KEY idx_users_is_active (is_active)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Core user accounts (travelers, some may be admins)';

-- ---------------------------------------------------------------------------
-- Table: admins
-- ---------------------------------------------------------------------------
-- Stores admin-specific metadata and roles, referencing the users table.
-- This allows tracking admin activity separately while still reusing the
-- same authentication model as regular users.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  user_id CHAR(36) NOT NULL COMMENT 'FK to users.id',
  admin_role ENUM('SUPER_ADMIN', 'ADMIN', 'ANALYST') NOT NULL DEFAULT 'ADMIN',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_user_id (user_id),
  CONSTRAINT fk_admins_user_id
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Admin metadata linked to users';

-- ---------------------------------------------------------------------------
-- Table: airports
-- ---------------------------------------------------------------------------
-- Stores airport metadata, primarily used for flight origin/destination
-- validation and richer search experiences.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS airports (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  iata_code CHAR(3) NOT NULL COMMENT 'IATA airport code (e.g., JFK, SFO)',
  icao_code CHAR(4) NULL COMMENT 'ICAO airport code (e.g., KJFK)',
  name VARCHAR(255) NOT NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(64) NULL,
  country VARCHAR(64) NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  timezone VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_airports_iata (iata_code),
  UNIQUE KEY uq_airports_icao (icao_code),
  KEY idx_airports_city_state (city, state),
  KEY idx_airports_country (country)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Airport metadata (IATA/ICAO codes, location, timezone)';

-- ---------------------------------------------------------------------------
-- Table: hotels
-- ---------------------------------------------------------------------------
-- Stores hotel-level metadata and baseline pricing.
-- Detailed room type and inventory information is stored in hotel_rooms.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotels (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(64) NOT NULL,
  zip VARCHAR(16) NOT NULL,
  country VARCHAR(64) NOT NULL DEFAULT 'United States',
  star_rating DECIMAL(2,1) NULL COMMENT 'Hotel star rating (1.0 - 5.0)',
  base_price_per_night DECIMAL(10,2) NOT NULL COMMENT 'Indicative base price per night',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  rating_avg DECIMAL(3,2) NULL COMMENT 'Aggregated average rating from reviews',
  rating_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of reviews used for rating_avg',
  check_in_time TIME NULL,
  check_out_time TIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hotels_city_state (city, state),
  KEY idx_hotels_city_price (city, base_price_per_night),
  KEY idx_hotels_city_stars (city, star_rating),
  KEY idx_hotels_is_active (is_active)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Hotel listings with base pricing and location metadata';

-- ---------------------------------------------------------------------------
-- Table: hotel_rooms
-- ---------------------------------------------------------------------------
-- Represents individual room types for each hotel, including inventory and
-- room-type-specific pricing. This allows a hotel to offer multiple room
-- categories (Standard, Deluxe, Suite, etc.).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  hotel_id CHAR(36) NOT NULL COMMENT 'FK to hotels.id',
  room_type VARCHAR(64) NOT NULL COMMENT 'e.g., STANDARD, DELUXE, SUITE',
  description TEXT NULL,
  max_occupancy INT UNSIGNED NOT NULL DEFAULT 2,
  base_price_per_night DECIMAL(10,2) NOT NULL COMMENT 'Room-type-specific base price per night',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  total_rooms INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total rooms of this type available at the property',
  rooms_available INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Current number of rooms available for booking',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hotel_rooms_hotel_id (hotel_id),
  KEY idx_hotel_rooms_type (room_type),
  CONSTRAINT fk_hotel_rooms_hotel_id
    FOREIGN KEY (hotel_id)
    REFERENCES hotels (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Per-hotel room types, inventory and pricing';

-- ---------------------------------------------------------------------------
-- Table: cars
-- ---------------------------------------------------------------------------
-- Stores rental car listings, including provider, vehicle details, and
-- base daily pricing. Pickup/dropoff locations may be city-based or tied
-- to specific airports via foreign keys.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cars (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  provider_name VARCHAR(255) NOT NULL COMMENT 'Rental provider or host name',
  car_type VARCHAR(64) NOT NULL COMMENT 'e.g., ECONOMY, COMPACT, SUV, LUXURY',
  make VARCHAR(64) NOT NULL COMMENT 'e.g., Toyota, Ford',
  model VARCHAR(64) NOT NULL COMMENT 'e.g., Corolla, Mustang',
  model_year SMALLINT UNSIGNED NOT NULL,
  transmission ENUM('AUTOMATIC', 'MANUAL') NOT NULL DEFAULT 'AUTOMATIC',
  seats INT UNSIGNED NOT NULL DEFAULT 4,
  daily_price DECIMAL(10,2) NOT NULL COMMENT 'Base daily rental price',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  pickup_city VARCHAR(120) NOT NULL,
  pickup_state VARCHAR(64) NOT NULL,
  pickup_country VARCHAR(64) NOT NULL DEFAULT 'United States',
  dropoff_city VARCHAR(120) NULL,
  dropoff_state VARCHAR(64) NULL,
  dropoff_country VARCHAR(64) NULL,
  pickup_airport_id CHAR(36) NULL COMMENT 'Optional FK to airports.id for airport pickup',
  dropoff_airport_id CHAR(36) NULL COMMENT 'Optional FK to airports.id for airport dropoff',
  rating_avg DECIMAL(3,2) NULL COMMENT 'Aggregated average rating from reviews',
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_cars_pickup_location (pickup_city, pickup_state),
  KEY idx_cars_daily_price (daily_price),
  KEY idx_cars_is_active (is_active),
  CONSTRAINT fk_cars_pickup_airport_id
    FOREIGN KEY (pickup_airport_id)
    REFERENCES airports (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_cars_dropoff_airport_id
    FOREIGN KEY (dropoff_airport_id)
    REFERENCES airports (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Rental car listings with provider, vehicle details, and pricing';

-- ---------------------------------------------------------------------------
-- Table: flights
-- ---------------------------------------------------------------------------
-- Stores scheduled flight information, including origin/destination airports,
-- departure/arrival times, base fare, and capacity. This table is used by
-- search APIs and booking flows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flights (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  flight_number VARCHAR(20) NOT NULL COMMENT 'Carrier flight number (e.g., UA123)',
  airline VARCHAR(120) NOT NULL COMMENT 'Airline/marketing carrier name',
  origin_airport_id CHAR(36) NOT NULL COMMENT 'FK to airports.id (origin)',
  destination_airport_id CHAR(36) NOT NULL COMMENT 'FK to airports.id (destination)',
  departure_time DATETIME NOT NULL COMMENT 'Departure timestamp (UTC or local, see app-level convention)',
  arrival_time DATETIME NOT NULL COMMENT 'Arrival timestamp (UTC or local, see app-level convention)',
  total_duration_minutes INT UNSIGNED NOT NULL COMMENT 'Precomputed duration in minutes for efficient sorting',
  stops TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of stops (0 = nonstop)',
  cabin_class ENUM('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST') NOT NULL DEFAULT 'ECONOMY',
  base_price DECIMAL(10,2) NOT NULL COMMENT 'Base ticket price (per seat)',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  seats_total INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total seat capacity',
  seats_available INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Seats currently available for booking',
  rating_avg DECIMAL(3,2) NULL COMMENT 'Aggregated average rating from reviews',
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flights_origin_dest_date (origin_airport_id, destination_airport_id, departure_time),
  KEY idx_flights_base_price (base_price),
  KEY idx_flights_is_active (is_active),
  CONSTRAINT fk_flights_origin_airport_id
    FOREIGN KEY (origin_airport_id)
    REFERENCES airports (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_flights_destination_airport_id
    FOREIGN KEY (destination_airport_id)
    REFERENCES airports (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Flight schedule, pricing, and capacity data';

SET FOREIGN_KEY_CHECKS = 1;
