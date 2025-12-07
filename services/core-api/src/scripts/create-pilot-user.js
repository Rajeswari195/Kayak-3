// import { fetch } from 'undici'; // Built-in fetch in Node 18+
import { mysqlQuery } from '../db/mysql.js';

const API_URL = (process.env.API_BASE_URL || "http://localhost:4000") + "/api/users";

const PILOT_USER = {
    firstName: "Pilot",
    lastName: "User",
    userId: "999-00-1111", // Distinct SSN
    email: "pilot.user@test.com",
    address: "123 Test Lane",
    city: "Test City",
    state: "CA",
    zip: "90001",
    country: "USA",
    phone: "555-0199",
    password: process.env.TEST_USER_PASSWORD || "password123",
    payment_method_token: "tok_visa_mock",
    payment_brand: "VISA",
    payment_last4: "4242"
};

async function createPilotUser() {
    console.log("🚀 Creating Pilot User:", PILOT_USER.email);

    // 1. Cleanup existing user if any
    try {
        await mysqlQuery("DELETE FROM users WHERE email = ?", [PILOT_USER.email]);
        console.log("   Cleaned up old pilot user data.");
    } catch (e) {
        console.warn("   Cleanup warning (ignorable):", e.message);
    }

    // 2. Register via API
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(PILOT_USER)
        });

        if (response.status === 201 || response.status === 200) {
            const data = await response.json();
            console.log("✅ Pilot User Created Successfully!");
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

createPilotUser();
