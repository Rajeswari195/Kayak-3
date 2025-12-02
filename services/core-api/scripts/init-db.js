import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
    console.log('Connecting to MySQL...');
    let connection;
    for (let i = 0; i < 30; i++) {
        try {
            connection = await mysql.createConnection({
                uri: 'mysql://kayak_user:kayak_pass@localhost:3306/kayak_core',
                multipleStatements: true
            });
            console.log('Connected!');
            break;
        } catch (err) {
            console.log(`Connection failed (attempt ${i + 1}/30): ${err.message}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    if (!connection) throw new Error('Could not connect to MySQL after retries');

    const sqlDir = path.resolve(__dirname, '../../../db/schema/mysql');
    const files = ['001-init-core-tables.sql', '002-bookings-billing-tables.sql'];

    for (const file of files) {
        console.log(`Running ${file}...`);
        const sql = fs.readFileSync(path.join(sqlDir, file), 'utf-8');
        await connection.query(sql);
        console.log(`Done ${file}`);
    }

    await connection.end();
    console.log('All scripts executed.');
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
