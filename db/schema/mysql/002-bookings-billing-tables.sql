/*
 * @file 002-bookings-billing-tables.sql
 * @description
 * MySQL schema for booking and billing-related entities in the Kayak-like
 * travel platform.
 *
 * Scope:
 * - bookings: booking headers referencing users, with overall status and totals
 * - booking_items: per-item rows for flights, hotels, and cars within a booking
 * - payment_methods: stored payment method references (tokens, last4, brand)
 * - billing_transactions: payment attempts/results tied to bookings
 *
 * Key design choices:
 * - Bookings are modeled as a header + line items, allowing a single booking
 *   to contain multiple assets (e.g., flight + hotel + car).
 * - Payment methods store only non-sensitive details and an opaque token.
 * - Billing transactions are separate from bookings to support multiple
 *   attempts, failures, refunds, and detailed audit trails.
 *
 * Assumptions:
 * - Tables from 001-init-core-tables.sql (users, flights, hotels, cars)
 *   already exist in the same schema.
 * - MySQL 8.x with InnoDB and utf8mb4 encoding.
 */

-- BEGIN WRITING FILE CODE

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Table: bookings
-- ---------------------------------------------------------------------------
-- Booking header table. Each booking is associated with a single user and
-- can include multiple items (flights, hotels, cars) represented in the
-- booking_items table.
--
-- The `start_date` and `end_date` columns reflect the overall earliest
-- and latest dates across all items to support simple scope queries
-- (past/current/future bookings).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  user_id CHAR(36) NOT NULL COMMENT 'FK to users.id',
  booking_reference VARCHAR(32) NOT NULL COMMENT 'Human-friendly booking reference code (unique)',
  status ENUM('PENDING', 'CONFIRMED', 'CANCELED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Total amount for all items in this booking',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  start_date DATE NULL COMMENT 'Earliest start date across booking items',
  end_date DATE NULL COMMENT 'Latest end date across booking items',
  notes TEXT NULL COMMENT 'Optional booking-level notes or metadata',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_reference (booking_reference),
  KEY idx_bookings_user_id (user_id),
  KEY idx_bookings_status (status),
  KEY idx_bookings_start_end (start_date, end_date),
  KEY idx_bookings_created_at (created_at),
  CONSTRAINT fk_bookings_user_id
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Booking headers linked to users with overall totals and statuses';

-- ---------------------------------------------------------------------------
-- Table: booking_items
-- ---------------------------------------------------------------------------
-- Detailed items within a booking. Each row represents a single asset:
-- flight, hotel, or car. For a bundled trip, there may be multiple items
-- of different types under the same booking_id.
--
-- The `metadata` column (JSON) captures additional structured details
-- (e.g., cabin class, room type, car options) without requiring extra
-- columns for every possible variant.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_items (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  booking_id CHAR(36) NOT NULL COMMENT 'FK to bookings.id',
  item_type ENUM('FLIGHT', 'HOTEL', 'CAR') NOT NULL,
  flight_id CHAR(36) NULL COMMENT 'FK to flights.id when item_type = FLIGHT',
  hotel_id CHAR(36) NULL COMMENT 'FK to hotels.id when item_type = HOTEL',
  car_id CHAR(36) NULL COMMENT 'FK to cars.id when item_type = CAR',
  start_date DATE NULL COMMENT 'Start date for this item (e.g., departure, check-in, pickup)',
  end_date DATE NULL COMMENT 'End date for this item (e.g., return, check-out, dropoff)',
  quantity INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Seats for flight, nights for hotel, or days for car',
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Price per unit (seat/night/day)',
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Precomputed total price for this item',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  metadata JSON NULL COMMENT 'Structured JSON with extra details (class, room type, etc.)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_booking_items_booking_id (booking_id),
  KEY idx_booking_items_item_type (item_type),
  KEY idx_booking_items_flight_id (flight_id),
  KEY idx_booking_items_hotel_id (hotel_id),
  KEY idx_booking_items_car_id (car_id),
  CONSTRAINT fk_booking_items_booking_id
    FOREIGN KEY (booking_id)
    REFERENCES bookings (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_booking_items_flight_id
    FOREIGN KEY (flight_id)
    REFERENCES flights (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_booking_items_hotel_id
    FOREIGN KEY (hotel_id)
    REFERENCES hotels (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_booking_items_car_id
    FOREIGN KEY (car_id)
    REFERENCES cars (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Per-asset items (flights, hotels, cars) associated with a booking';

-- ---------------------------------------------------------------------------
-- Table: payment_methods
-- ---------------------------------------------------------------------------
-- Stores non-sensitive, reusable payment method references for a user.
-- The actual sensitive card data is assumed to be stored with an external
-- payment provider and referenced via `token`.
--
-- Note: storing multiple methods per user allows selection of preferred
-- cards or providers (e.g., primary card vs backup, PayPal, etc.).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  user_id CHAR(36) NOT NULL COMMENT 'FK to users.id',
  method_type ENUM('CARD', 'PAYPAL', 'OTHER') NOT NULL DEFAULT 'CARD',
  token VARCHAR(128) NOT NULL COMMENT 'Opaque reference used by payment provider/simulator',
  brand VARCHAR(32) NULL COMMENT 'e.g., VISA, MASTERCARD, AMEX, PAYPAL',
  last4 CHAR(4) NULL COMMENT 'Last 4 digits of card number (if method_type = CARD)',
  exp_month TINYINT UNSIGNED NULL COMMENT 'Card expiry month (1-12)',
  exp_year SMALLINT UNSIGNED NULL COMMENT 'Card expiry year (YYYY)',
  is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if this is the default method for the user',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Soft-delete / disabled flag',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_payment_methods_user_id (user_id),
  KEY idx_payment_methods_is_default (user_id, is_default),
  CONSTRAINT fk_payment_methods_user_id
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Stored payment method references (non-sensitive, token-based) per user';

-- ---------------------------------------------------------------------------
-- Table: billing_transactions
-- ---------------------------------------------------------------------------
-- Records the outcome of payment attempts for bookings. Supports multiple
-- transactions per booking (e.g., retries, partial refunds).
--
-- Sensitive card data is NOT stored here; only tokens, provider references,
-- and non-sensitive details such as amount, currency, and status.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_transactions (
  id CHAR(36) NOT NULL COMMENT 'Primary key (UUID string)',
  booking_id CHAR(36) NOT NULL COMMENT 'FK to bookings.id',
  user_id CHAR(36) NOT NULL COMMENT 'FK to users.id',
  payment_method_id CHAR(36) NULL COMMENT 'Optional FK to payment_methods.id when using a stored method',
  amount DECIMAL(10,2) NOT NULL COMMENT 'Transaction amount',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_method ENUM('CARD', 'PAYPAL', 'OTHER') NOT NULL DEFAULT 'CARD',
  payment_token VARCHAR(128) NULL COMMENT 'Opaque token used for this transaction (if not referencing payment_methods)',
  provider_reference VARCHAR(128) NULL COMMENT 'Gateway/provider reference ID (e.g., simulated ID or PaymentIntent ID)',
  status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  error_code VARCHAR(64) NULL COMMENT 'Application-level error code for failed payments (e.g., insufficient_funds)',
  raw_response TEXT NULL COMMENT 'Optional serialized response from the payment simulator/provider for debugging',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_billing_booking_id (booking_id),
  KEY idx_billing_user_id (user_id),
  KEY idx_billing_status_created (status, created_at),
  CONSTRAINT fk_billing_transactions_booking_id
    FOREIGN KEY (booking_id)
    REFERENCES bookings (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_billing_transactions_user_id
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_billing_transactions_payment_method_id
    FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT='Payment attempts/results associated with bookings and users';

SET FOREIGN_KEY_CHECKS = 1;
