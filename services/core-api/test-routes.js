import { strict as assert } from 'node:assert';

const BASE_URL = 'http://localhost:4000';

async function test() {
    console.log('Waiting for server...');
    // Poll health
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch(`${BASE_URL}/health`);
            if (res.ok) break;
        } catch (e) { }
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('Server is up. Starting tests...');

    // 1. Health
    const health = await fetch(`${BASE_URL}/health`).then(r => r.json());
    console.log('Health:', health);
    assert.equal(health.status, 'ok');

    // 2. Register
    const email = `test${Date.now()}@example.com`;
    const password = 'password123';
    // Generate random SSN-like ID: XXX-XX-XXXX
    const userId = `000-${Math.floor(10 + Math.random() * 89)}-${Math.floor(1000 + Math.random() * 8999)}`;

    const registerPayload = {
        userId,
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        phone: '555-555-5555'
    };

    const registerRes = await fetch(`${BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerPayload)
    });
    const registerData = await registerRes.json();
    console.log('Register:', registerRes.status, registerData);

    // 3. Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginRes.status);
    const token = loginData.accessToken;

    if (!token) {
        console.error("Login failed, no token");
        return;
    }

    // 4. Get Profile
    const profileRes = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Profile:', profileRes.status, await profileRes.json());

    // 5. Search Flights
    const searchRes = await fetch(`${BASE_URL}/api/search/flights?origin=SFO&destination=JFK&date=2025-12-01`);
    console.log('Search Flights:', searchRes.status);

    // 6. Create Booking (Flight)
    // We'll try to create a booking. It might fail if flightId is invalid, but we want to test the route reachability and auth.
    const bookingRes = await fetch(`${BASE_URL}/api/bookings/flight`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ flightId: '123', passengers: 1, paymentMethodToken: 'tok_visa' })
    });
    console.log('Create Booking:', bookingRes.status, await bookingRes.json());

    // 7. Analytics
    const trackRes = await fetch(`${BASE_URL}/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'PAGE_VIEW', path: '/home' })
    });
    console.log('Track:', trackRes.status);

    // 8. Admin Route (should fail)
    const adminRes = await fetch(`${BASE_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Admin Route (User):', adminRes.status); // Should be 403

}

test().catch(console.error);
