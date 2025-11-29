# Kayak-Like Distributed Travel Metasearch & Agentic AI Recommendation Platform

This monorepo contains a **Kayak-like travel metasearch and booking platform** plus an **Agentic AI recommendation service**. It is designed as a teaching- and demo-friendly system that still looks and feels like a production-inspired distributed application.

> **Important:** All user data and SSN-like identifiers are synthetic and intended for educational use only.

---

## 1. High-Level Overview

### 1.1 What This Project Does

- Provides a **React SPA** for:
  - Travelers searching and booking **flights**, **hotels**, and **rental cars**
  - Admins managing **listings**, **users**, **billing**, and **analytics dashboards**

- Exposes a **Node.js + Express REST API** (`core-api`) that handles:
  - Users & auth (SSN-format user IDs, JWT with roles)
  - Listings: flights, hotels, cars
  - Booking & billing (transactional, rollback on failure)
  - Reviews, clickstream logging, admin analytics

- Implements an **Agentic AI Recommendation Service** (`ai-service`) with **FastAPI + SQLModel**:
  - Ingests & normalizes external datasets (Inside Airbnb NYC, Expedia flights, Global Airports)
  - Scores and tags deals via a Kafka-based pipeline
  - Exposes bundle recommendations and price/inventory watches over HTTP + WebSockets

- Uses a **multi-database** backend:
  - **MySQL** for core relational entities (users, bookings, billing, listings)
  - **MongoDB** for reviews, clickstream logs, audits, and flexible documents
  - **Redis** for SQL query caching and ephemeral data
  - **Kafka** for events and AI deals pipeline messaging

---

## 2. Tech Stack

### Client Tier

- **React SPA (JavaScript, not TypeScript)**
- React Router
- Tailwind CSS
- Shadcn UI
- Framer Motion
- lucide-react for icons
- React Query (or similar) for data fetching/caching

### Backend Tier

- **Core API**
  - Node.js (JavaScript, ESM)
  - Express
  - MySQL (via mysql2/knex or similar)
  - MongoDB (via Mongoose or native driver)
  - Redis (for caching)
  - Kafka (via kafkajs or similar)
  - JWT auth, bcrypt password hashing

- **AI Service**
  - FastAPI (Python)
  - Pydantic v2
  - SQLModel + SQLite
  - Kafka consumer/producer for deals pipeline
  - WebSockets for watched-deal notifications

### Infrastructure

- Docker for containerization
- Kubernetes (AWS EKS) for orchestration
- Self-hosted MySQL, MongoDB, Kafka, and Redis within the cluster
- Optional S3-compatible storage for assets (profile images, screenshots, exports)

---

## 3. Monorepo Layout

The repository is organized as a set of workspaces defined in the root `package.json`:

```text
/
├─ client/             # React SPA (user + admin UI)
├─ services/
│  ├─ core-api/        # Node.js + Express REST API
│  ├─ ai-service/      # FastAPI-based AI deals & concierge service
│  └─ workers/         # Background workers (Kafka analytics, deals ingest)
├─ db/
│  ├─ schema/          # MySQL/Mongo/SQLite schemas
│  └─ seed/            # Synthetic data generators & dataset loaders
├─ infra/
│  ├─ docker/          # Dockerfiles and local docker-compose
│  └─ k8s/             # Kubernetes manifests / Helm charts
├─ lib/                # Shared libraries (logging, errors, Kafka topics, validation)
├─ types/              # Shared JSDoc typedefs / JSON schemas
├─ prompts/            # Concierge / AI prompt templates
├─ scripts/            # Helper scripts (init DBs, load tests, exports)
├─ package.json        # Root workspace configuration
├─ package-workspaces.json
└─ jsconfig.json       # Path alias configuration for @/*
