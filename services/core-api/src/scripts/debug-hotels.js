
import { mysqlQuery } from "../db/mysql.js";

async function debugHotels() {
    try {
        console.log("Searching for Mumbai hotels...");
        const hotels = await mysqlQuery("SELECT * FROM hotels WHERE city = 'Mumbai'");
        console.log(`Found ${hotels.length} hotels in Mumbai.`);

        for (const h of hotels) {
            console.log(`\nHotel: ${h.name} (ID: ${h.id})`);
            const rooms = await mysqlQuery("SELECT * FROM hotel_rooms WHERE hotel_id = ?", [h.id]);
            console.log(`  Rooms found: ${rooms.length}`);
            rooms.forEach(r => {
                console.log(`    - ${r.room_type}: ${r.rooms_available} available (Price: ${r.base_price_per_night})`);
            });
        }
        process.exit(0);
    } catch (err) {
        console.error("Debug failed:", err);
        process.exit(1);
    }
}

debugHotels();
