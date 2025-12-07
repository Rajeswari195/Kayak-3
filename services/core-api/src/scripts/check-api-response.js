
// Native fetch is available in Node 18+

const API_URL = (process.env.API_BASE_URL || "http://localhost:4000") + "/api";
const EMAIL = "rahul.pillai@ca.com";
const PASSWORD = process.env.TEST_USER_PASSWORD || "password123";

async function check() {
    console.log("Logging in as", EMAIL);
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });

    const loginData = await loginRes.json();
    const token = loginData?.data?.token || loginData?.accessToken; // Handle inconsistent login response if any
    console.log("Login Data keys:", Object.keys(loginData));

    if (!token) {
        console.error("No token found!");
        return;
    }

    console.log("Fetching Bookings...");
    const bookRes = await fetch(`${API_URL}/bookings?scope=future`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    const bookData = await bookRes.json();
    console.log("--- BOOKINGS API RESPONSE ---");
    console.log(JSON.stringify(bookData, null, 2));
    console.log("-----------------------------");
}

check();
