import fs from 'fs';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { mysqlQuery } from '../db/mysql.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - Absolute paths to CSVs (using the paths we know exist)
const FLIGHTS_CSV = path.join(__dirname, '../../../ai-service/data/flights.csv');
const HOTELS_CSV = path.join(__dirname, '../../../ai-service/data/Airbnb_India_Top_500.csv');

async function seed() {
    console.log("🚀 Starting Kaggle Data Migration...");

    try {
        // 1. Fetch Airports Map (City Name -> ID)
        // We need this to map "Delhi" -> UUID
        console.log("   Loading airports map...");
        const airports = await mysqlQuery("SELECT id, city, iata_code FROM airports");
        const cityToId = {};

        // Create a robust map: City Name -> ID
        airports.forEach(a => {
            if (a.city) cityToId[a.city.toLowerCase()] = a.id;
            // Also map IATA just in case
            if (a.iata_code) cityToId[a.iata_code.toLowerCase()] = a.id;
        });

        // Special handling for "New Delhi" / "Delhi" mismatch if any
        if (cityToId['new delhi']) cityToId['delhi'] = cityToId['new delhi'];

        console.log(`   ✅ Loaded ${airports.length} airports.`);

        // 2. Process Flights
        console.log("   Processing Flights CSV...");
        await processFlights(cityToId);

        // 3. Process Hotels
        console.log("   Processing Hotels CSV...");
        await processHotels();

        console.log("✅ Migration Complete!");
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Migration Failed:", error);
        process.exit(1);
    }
}

async function processFlights(cityToId) {
    return new Promise((resolve, reject) => {
        const flights = [];
        let count = 0;

        fs.createReadStream(FLIGHTS_CSV)
            .pipe(csv())
            .on('data', (row) => {
                // Map Source/Dest cities to IDs
                const originId = cityToId[row.source_city.toLowerCase()];
                const destId = cityToId[row.destination_city.toLowerCase()];

                if (originId && destId) {
                    // Generate Departure Date: Today + days_left
                    const departureDate = new Date();
                    departureDate.setDate(departureDate.getDate() + parseInt(row.days_left || 1));

                    // Set Time (Morning/Evening/Night mapping)
                    const timeMap = {
                        "Early_Morning": 6,
                        "Morning": 9,
                        "Afternoon": 14,
                        "Evening": 18,
                        "Night": 21
                    };
                    const hour = timeMap[row.departure_time] || 12;
                    departureDate.setHours(hour, 0, 0, 0);

                    // Calculate Arrival Time based on duration
                    const durationMinutes = parseFloat(row.duration) * 60;
                    const arrivalDate = new Date(departureDate.getTime() + durationMinutes * 60000);

                    flights.push([
                        uuidv4(), // id
                        row.flight || `FL-${Math.floor(Math.random() * 10000)}`, // flight_number
                        row.airline, // airline
                        originId, // origin_airport_id
                        destId, // destination_airport_id
                        departureDate, // departure_time
                        arrivalDate, // arrival_time
                        Math.round(durationMinutes), // total_duration_minutes
                        mapStops(row.stops), // stops
                        'ECONOMY', // cabin_class (default)
                        parseFloat(row.price), // base_price
                        'USD', // currency (assuming USD for consistency with app, though CSV might be INR)
                        180, // seats_total (mock)
                        180, // seats_available (mock)
                        1 // is_active
                    ]);
                    count++;
                }
            })
            .on('end', async () => {
                if (flights.length > 0) {
                    // Batch insert could be huge. Let's do it in chunks or one big query depending on size.
                    // For safety, let's insert one by one or smaller chunks. 
                    // Given the loop might be slow for SQL, let's try chunks of 50.
                    console.log(`   Found ${count} valid flights. Inserting...`);

                    const chunkSize = 50;
                    for (let i = 0; i < flights.length; i += chunkSize) {
                        const chunk = flights.slice(i, i + chunkSize);
                        const sql = `
                            INSERT INTO flights 
                            (id, flight_number, airline, origin_airport_id, destination_airport_id, departure_time, arrival_time, total_duration_minutes, stops, cabin_class, base_price, currency, seats_total, seats_available, is_active)
                            VALUES ?
                        `;
                        await mysqlQuery(sql, [chunk]);
                    }
                }
                console.log("   ✅ Flights inserted.");
                resolve();
            })
            .on('error', reject);
    });
}

function mapStops(stopsStr) {
    if (stopsStr === 'zero') return 0;
    if (stopsStr === 'one') return 1;
    if (stopsStr === 'two_or_more') return 2;
    return 0;
}

async function processHotels() {
    return new Promise((resolve, reject) => {
        const hotels = [];
        const rooms = [];
        let count = 0;

        if (!fs.existsSync(HOTELS_CSV)) {
            console.error(`ERROR: File not found: ${HOTELS_CSV}`);
            return resolve();
        }
        const stats = fs.statSync(HOTELS_CSV);
        console.log(`DEBUG: File size: ${stats.size} bytes`);

        fs.createReadStream(HOTELS_CSV)
            .pipe(csv())
            .on('data', (row) => {
                // Correct Column Mapping for Airbnb_India_Top_500.csv
                // Headers: address,isHostedBySuperhost,location/lat,location/lng,name,numberOfGuests,pricing/rate/amount,roomType,stars

                if (count === 0) {
                    console.log("DEBUG: Row Keys:", Object.keys(row));
                    console.log("DEBUG: First Row:", row);
                }

                const price = parseFloat(row['pricing/rate/amount']);
                const name = row.name;

                if (price > 0 && name) {
                    // Extract City from Address (e.g. "Manali, Himachal Pradesh, India")
                    const addressParts = (row.address || "").split(',');
                    const city = addressParts[0] ? addressParts[0].trim() : "Unknown";
                    const state = addressParts[1] ? addressParts[1].trim() : "India";
                    const hotelId = uuidv4();

                    hotels.push([
                        hotelId, // id
                        name.substring(0, 255), // name
                        "Kaggle Import", // description (marker)
                        row.address || "Unknown Address", // address_line1
                        city, // city
                        state, // state
                        "00000", // zip
                        "India", // country
                        parseFloat(row.stars) || 4.0, // star_rating
                        price, // base_price_per_night
                        "USD", // currency
                        1 // is_active
                    ]);

                    // Add default room inventory
                    rooms.push([
                        uuidv4(), // id
                        hotelId, // hotel_id
                        "STANDARD", // room_type
                        "Standard Room", // description
                        2, // max_occupancy
                        price, // base_price_per_night
                        "USD", // currency
                        50, // total_rooms
                        50, // rooms_available
                        1 // is_active
                    ]);
                    count++;
                }
            })
            .on('end', async () => {
                if (hotels.length > 0) {
                    console.log(`   Found ${count} valid hotels. Inserting...`);

                    const chunkSize = 50;

                    if (hotels.length > 0) {
                        console.log(`DEBUG: Sample Hotel ID being inserted: ${hotels[0][0]}`);
                    }

                    // Insert Hotels
                    for (let i = 0; i < hotels.length; i += chunkSize) {
                        const chunk = hotels.slice(i, i + chunkSize);
                        const sql = `
                            INSERT INTO hotels 
                            (id, name, description, address_line1, city, state, zip, country, star_rating, base_price_per_night, currency, is_active)
                            VALUES ?
                        `;
                        const res = await mysqlQuery(sql, [chunk]);
                        // Log result of first chunk
                        if (i === 0) console.log("DEBUG: Hotels Insert Result:", res);
                    }
                    console.log("   ✅ Hotels inserted.");

                    // Insert Rooms
                    console.log("   Inserting Room Inventory...");
                    for (let i = 0; i < rooms.length; i += chunkSize) {
                        const chunk = rooms.slice(i, i + chunkSize);
                        const sql = `
                            INSERT INTO hotel_rooms 
                            (id, hotel_id, room_type, description, max_occupancy, base_price_per_night, currency, total_rooms, rooms_available, is_active)
                            VALUES ?
                        `;
                        const res = await mysqlQuery(sql, [chunk]);
                        if (i === 0) console.log("DEBUG: Rooms Insert Result:", res);
                    }
                    console.log("   ✅ Hotel Rooms inserted.");
                }
                resolve();
            })
            .on('error', reject);
    });
}

seed();
