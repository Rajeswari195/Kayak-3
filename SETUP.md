# Kayak-Like Travel Platform - Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.10 or higher) - [Download](https://www.python.org/)
- **MySQL** (v8.0 or higher) - [Download](https://dev.mysql.com/downloads/)
- **Docker** (optional, recommended for MySQL) - [Download](https://www.docker.com/)
- **Git** - [Download](https://git-scm.com/)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd kayak-3
```

### 2. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and configuration:

```bash
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=kayak_user
MYSQL_PASSWORD=kayak_pass
MYSQL_DATABASE=kayak_core
MYSQL_URL=mysql://kayak_user:kayak_pass@localhost:3306/kayak_core

# API Services
API_BASE_URL=http://localhost:4000
AI_SERVICE_BASE_URL=http://localhost:8001
AI_SERVICE_WS_URL=ws://127.0.0.1:8001/ws/concierge

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Test Configuration (optional)
TEST_USER_PASSWORD=password123
```

### 3. Database Setup

#### Option A: Using Docker (Recommended)

```bash
# Start MySQL container
docker-compose up -d mysql

# Wait for MySQL to be ready (about 10-15 seconds)
sleep 15
```

#### Option B: Using Local MySQL

1. Start your MySQL server
2. Create the database and user:

```sql
CREATE DATABASE kayak_core;
CREATE USER 'kayak_user'@'localhost' IDENTIFIED BY 'kayak_pass';
GRANT ALL PRIVILEGES ON kayak_core.* TO 'kayak_user'@'localhost';
FLUSH PRIVILEGES;
```

#### Initialize Database Schema

```bash
cd services/core-api
npm install
npm run db:init
```

### 4. Install Dependencies

#### Download Required Data Files

The `destinations.csv` file is too large for GitHub. Download it from Kaggle:

**Download destinations.csv:**
1. Visit: https://www.kaggle.com/competitions/expedia-hotel-recommendations/data
2. Download the `destinations.csv` file
3. Move it to: `services/ai-service/data/destinations.csv`

```bash
# After downloading, place the file in the correct location:
mv ~/Downloads/destinations.csv services/ai-service/data/
```

**Note**: All other CSV files are included in the repository. Only `destinations.csv` needs to be downloaded separately from Kaggle.

#### Core API (Node.js Backend)

```bash
cd services/core-api
npm install
```

#### AI Service (Python Backend)

```bash
cd services/ai-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Client (React Frontend)

```bash
cd client
npm install
```

### 5. Seed Sample Data

```bash
cd services/core-api
npm run seed
```

This will populate the database with:
- Sample flights
- Sample hotels
- Sample airports
- Test users

### 6. Start the Services

Open **three separate terminal windows**:

#### Terminal 1: Core API

```bash
cd services/core-api
npm run dev
```

The API will start on `http://localhost:4000`

#### Terminal 2: AI Service

```bash
cd services/ai-service
source venv/bin/activate  # On Windows: venv\Scripts\activate
npm run dev
```

The AI service will start on `http://localhost:8001`

#### Terminal 3: Frontend Client

```bash
cd client
npm run dev
```

The frontend will start on `http://localhost:5173`

### 7. Access the Application

Open your browser and navigate to:

**http://localhost:5173**

---

## Testing the Application

### Register a New User

1. Click "Register" in the top-right corner
2. Fill in the registration form
3. Click "Create Account"

### Test AI Concierge

1. Click the AI Concierge button (floating chat icon)
2. Wait for the green dot (indicates connected)
3. Type: "Plan a trip to London for Jan 10 2026"
4. Follow the prompts to book a bundle

### View Bookings

1. Click "My Bookings" in the header
2. Verify your booking appears in "Upcoming Bookings"

---

## Project Structure

```
kayak-3/
├── client/                 # React frontend (Vite)
├── services/
│   ├── core-api/          # Node.js/Express API
│   └── ai-service/        # Python/FastAPI AI service
├── db/
│   └── schema/            # Database schemas
├── .env.example           # Environment template
└── docker-compose.yml     # Docker configuration
```

---

## Common Issues & Troubleshooting

### MySQL Connection Failed

**Error**: `ECONNREFUSED` or `Access denied`

**Solution**:
1. Verify MySQL is running: `mysql -u kayak_user -p`
2. Check credentials in `.env` match your MySQL setup
3. Ensure database exists: `SHOW DATABASES;`

### AI Concierge Shows "Offline"

**Solution**:
1. Verify AI service is running on port 8001
2. Check browser console for WebSocket errors
3. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)

### Port Already in Use

**Error**: `EADDRINUSE: address already in use`

**Solution**:
```bash
# Find and kill the process using the port
lsof -ti:4000 | xargs kill -9  # For Core API
lsof -ti:8001 | xargs kill -9  # For AI Service
lsof -ti:5173 | xargs kill -9  # For Frontend
```

### Python Virtual Environment Issues

**Solution**:
```bash
cd services/ai-service
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Database Schema Out of Sync

**Solution**:
```bash
cd services/core-api
npm run db:init  # Re-run schema initialization
npm run seed     # Re-seed data
```

---

## Development Workflow

### Making Changes

1. **Backend API Changes**: Edit files in `services/core-api/src/`
   - Server auto-restarts with nodemon

2. **AI Service Changes**: Edit files in `services/ai-service/app/`
   - Restart the service manually: `npm run dev`

3. **Frontend Changes**: Edit files in `client/src/`
   - Hot module replacement (HMR) updates automatically

### Running Tests

```bash
# Core API tests
cd services/core-api
npm test

# AI Service tests
cd services/ai-service
source venv/bin/activate
pytest
```

### Database Management

```bash
# Clear all test data
cd services/ai-service
python3 clear_all_data.py

# Re-seed database
cd services/core-api
npm run seed
```

---

## Production Deployment

### Environment Variables

Update `.env` with production values:

```bash
# Use strong, random secrets
JWT_SECRET=<generate-with-openssl-rand-base64-32>

# Use production database
MYSQL_HOST=your-production-db-host
MYSQL_USER=your-production-db-user
MYSQL_PASSWORD=<strong-password>

# Update API URLs
API_BASE_URL=https://api.yourdomain.com
AI_SERVICE_BASE_URL=https://ai.yourdomain.com
```

### Build for Production

```bash
# Build frontend
cd client
npm run build

# Build outputs to client/dist/

# Core API and AI Service run directly (no build step needed)
```

---

## Additional Resources

- **API Documentation**: `http://localhost:4000/api-docs` (when running)
- **Database Schema**: See `db/schema/mysql/` for SQL files
- **Environment Variables**: See `.env.example` for all options

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs in terminal windows
3. Verify all services are running
4. Check browser console for frontend errors

---

## License

[Your License Here]
