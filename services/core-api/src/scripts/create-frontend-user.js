```javascript
// import { fetch } from 'undici'; // Built-in fetch in Node 18+
import { mysqlQuery } from '../db/mysql.js';

const API_URL = (process.env.API_BASE_URL || "http://localhost:4000") + "/api/users";

const FRONTEND_USER = {
    firstName: "Frontend",
    lastName: "User",
    userId: "FU001",
    email: "frontend.user@test.com",
    address: "456 Dev Blvd",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    country: "USA",
    phone: "555-0200",
    password: process.env.TEST_USER_PASSWORD || "password123",
    payment_method_token: "tok_visa_mock_frontend", // Mock token
    payment_brand: "VISA",
    payment_last4: "4242"
};

async function createFrontendUser() {
    console.log("🚀 Creating Frontend User:", FRONTEND_USER.email);

    // 1. Cleanup existing user if any
    try {
        await mysqlQuery("DELETE FROM users WHERE email = ?", [FRONTEND_USER.email]);
        console.log("   Cleaned up old user data.");
    } catch (e) {
        console.warn("   Cleanup warning (ignorable):", e.message);
    }

    // 2. Register via API (using fetch)
    // We import standard http/https if fetch isn't available, but Node 18+ has it.
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(FRONTEND_USER)
        });

        if (response.status === 201 || response.status === 200) {
            const data = await response.json();
            console.log("✅ Frontend User Created Successfully!");
            console.log("   ID:", data.user ? data.user.id : "N/A");
            process.exit(0);
        } else {
            const errText = await response.text();
            console.error("❌ Failed to create user:", response.status, errText);
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Network/Script Error:", error);
        process.exit(1);
    }
}

createFrontendUser();
