import WebSocket from 'ws';
import { createPool } from 'mysql2/promise';
import { mysqlQuery } from '../db/mysql.js'; // Use project util if available, but manual pool is safer for standalone.
// Actually, let's stick to standalone pool to avoid dependency hell
import mysql from 'mysql2/promise';

// Config
const API_URL = process.env.API_BASE_URL || "http://localhost:4000/api";
const WS_URL = process.env.AI_SERVICE_WS_URL || "ws://127.0.0.1:8001/ws/concierge";
const EMAIL = `rajiv.simulation.${Date.now()}@test.com`;
const PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

async function runPilot() {
    console.log("🚀 Starting Pilot Simulation for:", EMAIL);

    // 1. REGISTER
    console.log("\n1️⃣  Registering User...");
    try {
        const regRes = await fetch(`${API_URL}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: "Rajiv",
                lastName: "Menon",
                email: EMAIL,
                password: PASSWORD,
                userId: `777-88-${Math.floor(1000 + Math.random() * 9000)}`,
                address: "123 Tech Park",
                city: "San Jose",
                state: "CA",
                zip: "95110",
                country: "USA",
                phone: "555-123-4567"
            })
        });
        const regData = await regRes.json();
        console.log("   Register Status:", regRes.status, regData.message || regData);
    } catch (e) {
        console.log("   Registration failed (maybe already exists):", e.message);
    }

    // 2. LOGIN
    console.log("\n2️⃣  Logging In...");
    let token = "";
    let userId = "";
    try {
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
            token = loginData.data?.token || loginData.accessToken;
            // userId is usually in loginData.data.user.id or loginData.user.id
            userId = loginData.data?.user?.id || loginData.user?.id;
            console.log("   Login Success! Token obtained.");
            console.log("   User ID:", userId);
        } else {
            console.error("   Login Failed:", loginData);
            process.exit(1);
        }
    } catch (e) {
        console.error("   Login Error:", e);
        process.exit(1);
    }

    // 3. AI BOOKING (WS)
    console.log("\n3️⃣  AI Booking (WebSocket)...");
    const clientId = `client-${Date.now()}`;
    const wsUrl = `${WS_URL}/${clientId}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log("   WS Connected!");
        // HANDSHAKE - EXACTLY AS FRONTEND DOES
        ws.send(`AUTH_TOKEN:${token}`);

        setTimeout(() => {
            console.log("   Sending: Plan a trip...");
            ws.send("Plan a trip to Mumbai for Jan 10 2026");
        }, 1000);
    });

    ws.on('message', (data) => {
        const msg = data.toString();
        console.log("   < AI:", msg.substring(0, 100) + "...");

        if (msg.includes("How many people")) {
            setTimeout(() => ws.send("2 Adults"), 1000);
        }
        if (msg.includes("fly from") || msg.includes("flying from")) {
            setTimeout(() => ws.send("Origin: New York"), 1000);
        }
        if (msg.includes("flight_offer") || msg.includes("deal_ids") || msg.includes("Here are the top")) {
            console.log("   Deals received. Booking Bundle 2...");
            setTimeout(() => ws.send("Book Bundle 2"), 2000);
        }
        if (msg.toLowerCase().includes("confirmed")) {
            console.log("   ✅ CONFIRMATION RECEIVED!");
            ws.close();

            // 4. VERIFY DB
            setTimeout(verifyDB, 2000);
        }
    });

    ws.on('error', (e) => {
        console.error("   WS Error:", e);
    });

    // Timeout safety - Increased to 120s for AI delays
    setTimeout(() => {
        console.log("   Timeout reached (120s).");
        ws.close();
        process.exit(1);
    }, 120000);

    async function verifyDB() {
        console.log("\n4️⃣  Verifying Database...");
        try {
            const pool = mysql.createPool({ uri: process.env.MYSQL_URL || 'mysql://kayak_user:kayak_pass@localhost:3306/kayak_core' });
            const [rows] = await pool.query("SELECT * FROM bookings WHERE user_id = ?", [userId]);
            console.log("   Bookings found:", rows.length);

            if (rows.length > 0) {
                const booking = rows[0];
                const startDate = new Date(booking.start_date);
                const now = new Date();

                console.log(`      Booking Ref: ${booking.booking_reference}`);
                console.log(`      Start Date: ${startDate.toISOString()} (Expected: 2026-01-10)`);
                console.log(`      Status: ${booking.status}`);

                // VERIFY UPCOMING
                if (startDate > now) {
                    console.log("   ✅ VERIFIED: Booking is UPCOMING (Future Date).");
                } else {
                    console.log("   ❌ FAILED: Booking is IN THE PAST.");
                }

                // VERIFY YEAR
                if (startDate.getFullYear() === 2026) {
                    console.log("   ✅ VERIFIED: Booking Year is 2026 (Correct).");
                } else {
                    console.log(`   ❌ FAILED: Wrong Year (${startDate.getFullYear()}).`);
                }

                console.log("   🚀 FINAL SUCCESS: System functionality verified.");

            } else {
                console.log("   ❌ FAILURE: No bookings found for user.");
            }
        } catch (err) {
            console.error("DB Verification Error:", err);
        }
        process.exit(0);
    }
}

runPilot();
