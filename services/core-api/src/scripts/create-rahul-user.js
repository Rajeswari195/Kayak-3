```javascript

import { mysqlQuery } from '../db/mysql.js';

const API_URL = (process.env.API_BASE_URL || "http://localhost:4000") + "/api/users";

const RAHUL_USER = {
    firstName: "Rahul",
    lastName: "Pillai",
    userId: "888-00-5555",
    email: "rahul.pillai@ca.com", // Keeping exact email user requested
    address: "456 Bay St",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    country: "USA",
    phone: "555-0300",
    password: process.env.TEST_USER_PASSWORD || "password123",
    payment_method_token: "tok_visa_mock_rahul",
    payment_brand: "VISA",
    payment_last4: "8888"
};

async function createRahulUser() {
    console.log("🚀 Creating Rahul User:", RAHUL_USER.email);

    // 1. Cleanup existing user if any
    try {
        await mysqlQuery("DELETE FROM users WHERE email = ?", [RAHUL_USER.email]);
        console.log("   Cleaned up old user data.");
    } catch (e) {
        console.warn("   Cleanup warning (ignorable):", e.message);
    }

    // 2. Register via API
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(RAHUL_USER)
        });

        if (response.status === 201 || response.status === 200) {
            const data = await response.json();
            console.log("✅ Rahul User Created Successfully!");
            console.log("   ID:", data.user ? data.user.id : "N/A");
            process.exit(0);
        } else {
            // If failed (maybe existing?), we can't login easily. So this step is critical.
            const errText = await response.text();
            console.error("❌ Failed to create user:", response.status, errText);
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Network/Script Error:", error);
        process.exit(1);
    }
}

createRahulUser();
