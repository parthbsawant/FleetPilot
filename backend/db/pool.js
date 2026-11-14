//Why pool.js --> this is because we want one reusable data base 
//connection pool which can be imported wherever database access is required

import pg from 'pg';
import {config, isProduction} from '../config.js';

pg.types.setTypeParser(1082, (text) => text);
// we tell the pg not to convert the received date into js date object
// rather we tell it to store as a string (store as it is received)

const { Pool } = pg;

export const pool = new Pool({
    connectionString : config.databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false} : false
});

pool.on('error', (err) => {
    console.error('Unexpected database error', err.message);
});
