
import { pool } from './backend/db/pool.js';

const typed = "x' OR '1'='1";

// UNSAFE: user input is directly inserted into SQL
const unsafeSql = `SELECT registration_number
                   FROM vehicles
                   WHERE registration_number = '${typed}'`;

console.log('SQL sent:', unsafeSql);

const unsafe = await pool.query(unsafeSql);

console.log('Unsafe query returned', unsafe.rows.length, 'rows');

// SAFE: SQL and user input are sent separately
const safe = await pool.query(
    'SELECT registration_number FROM vehicles WHERE registration_number = $1',
    [typed]
);

console.log('Safe query returned', safe.rows.length, 'rows');

await pool.end();
