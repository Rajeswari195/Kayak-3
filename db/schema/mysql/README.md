/**
 * @file README.md
 * @description
 * Documentation for the MySQL schema used by the Kayak-like travel platform.
 *
 * This schema defines the relational backbone for:
 * - Users & admins
 * - Airports, flights, hotels, hotel rooms, cars
 * - Bookings, booking items, payment methods, billing transactions
 *
 * It is intentionally focused on:
 * - Strong referential integrity via foreign keys and cascades
 * - Pragmatic indexing for common query patterns
 * - Compatibility with the Node.js + Express core-api services
 *
 * Notes:
 * - All IDs are modeled as `CHAR(36)` to store UUID strings.
 * - Application-layer validation (SSN format, US state/ZIP, etc.) is enforced
 *   in the Node.js core-api; the DB enforces uniqueness and relationships.
 */

BEGIN WRITING FILE CODE

# MySQL Schema Overview

This directory contains the MySQL DDL scripts for the **Kayak-Like Distributed Travel Metasearch & Agentic AI Recommendation Platform**.

The schema is split into two main files:

- `001-init-core-tables.sql` – Core entities (users, admins, airports, flights, hotels, hotel_rooms, cars)
- `002-bookings-billing-tables.sql` – Booking and billing entities (bookings, booking_items, payment_methods, billing_transactions)

The scripts are designed to be **idempotent** (they use `CREATE TABLE IF NOT EXISTS`) and rely on **InnoDB** with **utf8mb4** encoding.

> **Important:** These scripts assume that the MySQL database (schema) has already been created and selected (e.g., `CREATE DATABASE kayak_core; USE kayak_core;`).

---

## 1. Running the Schema

From your terminal:

```bash
# Example: apply schema to a local MySQL instance
mysql -u root -p \
  -h localhost \
  -D kayak_core \
  < db/schema/mysql/001-init-core-tables.sql

mysql -u root -p \
  -h localhost \
  -D kayak_core \
  < db/schema/mysql/002-bookings-billing-tables.sql
