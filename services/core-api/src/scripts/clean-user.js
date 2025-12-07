
import { mysqlQuery } from "../db/mysql.js";

async function cleanUser() {
    const email = "akshay.menon@usa.com";
    try {
        console.log(`Cleaning data for ${email}...`);

        // 1. Get User ID
        const users = await mysqlQuery("SELECT id FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            console.log("User not found.");
            process.exit(0);
        }
        const userId = users[0].id;
        console.log(`Found User ID: ${userId}`);

        // 2. Get Bookings
        const bookings = await mysqlQuery("SELECT id FROM bookings WHERE user_id = ?", [userId]);
        const bookingIds = bookings.map(b => b.id);

        if (bookingIds.length > 0) {
            console.log(`Found ${bookingIds.length} bookings to delete.`);

            const placeholders = bookingIds.map(() => '?').join(',');

            // 3. Delete Billing
            await mysqlQuery(`DELETE FROM billing_transactions WHERE booking_id IN (${placeholders})`, bookingIds);
            console.log("Deleted billing transactions.");

            // 4. Delete Booking Items
            await mysqlQuery(`DELETE FROM booking_items WHERE booking_id IN (${placeholders})`, bookingIds);
            console.log("Deleted booking items.");

            // 5. Delete Bookings
            await mysqlQuery(`DELETE FROM bookings WHERE id IN (${placeholders})`, bookingIds);
            console.log("Deleted bookings.");
        } else {
            console.log("No bookings found.");
        }

        console.log("Cleanup complete.");
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
}

cleanUser();
