
import { mysqlQuery } from "../db/mysql.js";

async function checkSchema() {
    try {
        const cols = await mysqlQuery("SHOW COLUMNS FROM hotel_rooms");
        console.log(cols);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkSchema();
