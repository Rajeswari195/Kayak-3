import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import process from 'process';

dotenv.config({ path: '../.env' });

const userId = process.argv[2];
if (!userId) {
    console.error("Usage: node generate-token.js <user_id>");
    process.exit(1);
}

const secret = process.env.JWT_SECRET || 'replace-with-a-long-random-secret-value';
// Middleware expects 'sub' claim for user ID
const token = jwt.sign({ sub: userId, email: 'akshay.menon@usa.com', role: 'user' }, secret, { expiresIn: '1h' });

console.log(token);
