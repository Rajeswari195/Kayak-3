
import { mysqlQuery } from "../db/mysql.js";
import { randomUUID } from "node:crypto";

async function fixHotelRooms() {
    try {
        console.log("Fixing missing hotel rooms...");
        const hotels = await mysqlQuery("SELECT * FROM hotels");

        let fixedCount = 0;

        for (const h of hotels) {
            const rooms = await mysqlQuery("SELECT * FROM hotel_rooms WHERE hotel_id = ?", [h.id]);
            if (rooms.length === 0) {
                console.log(`Adding STANDARD room for hotel: ${h.name} (${h.id})`);

                await mysqlQuery(`
          INSERT INTO hotel_rooms (
            id, hotel_id, room_type, base_price_per_night, currency, 
            total_rooms, rooms_available, is_active, created_at, updated_at
          ) VALUES (?, ?, 'STANDARD', ?, ?, 50, 50, 1, NOW(), NOW())
        `, [
                    randomUUID(),
                    h.id,
                    h.base_price_per_night || 100,
                    h.currency || 'USD'
                ]);

                fixedCount++;
            }
        }

        console.log(`\nFixed ${fixedCount} hotels.`);
        process.exit(0);
    } catch (err) {
        console.error("Fix failed:", err);
        process.exit(1);
    }
}

fixHotelRooms();
